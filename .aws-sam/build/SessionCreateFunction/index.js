const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.SESSIONS_TABLE_NAME;

exports.handler = async (event) => {
  console.log('세션 생성 요청:', JSON.stringify(event, null, 2));

  // CORS preflight 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const sessionId = `sess_${uuidv4()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2시간 후
    
    const sessionRecord = {
      sessionId,
      status: 'idle',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivity: now.toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000), // DynamoDB TTL
      retryCount: 0,
      maxRetries: 3
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: sessionRecord
    }).promise();

    console.log('세션 생성 완료:', sessionId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessionId: sessionRecord.sessionId,
        createdAt: sessionRecord.createdAt,
        expiresAt: sessionRecord.expiresAt
      })
    };

  } catch (error) {
    console.error('세션 생성 실패:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: '세션 생성 중 오류가 발생했습니다'
      })
    };
  }
};
