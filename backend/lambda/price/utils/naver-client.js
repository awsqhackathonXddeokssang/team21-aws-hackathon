const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API 키 캐시
let cachedApiKeys = null;

// Secrets Manager에서 네이버 API 키 가져오기
async function getNaverApiKeys() {
    if (cachedApiKeys) {
        return cachedApiKeys;
    }
    
    const client = new SecretsManagerClient({
        region: 'us-east-1'
    });
    
    try {
        console.log('Secrets Manager에서 API 키 조회 중...');
        const command = new GetSecretValueCommand({
            SecretId: 'ai-chef/naver-api'
        });
        const result = await client.send(command);
        
        const secret = JSON.parse(result.SecretString);
        cachedApiKeys = {
            clientId: secret.client_id,
            clientSecret: secret.client_secret
        };
        
        console.log('API 키 조회 성공:', { clientId: cachedApiKeys.clientId ? '***설정됨***' : '없음' });
        return cachedApiKeys;
    } catch (error) {
        console.error('Secrets Manager 조회 실패:', error);
        throw new Error('Failed to retrieve Naver API keys');
    }
}

const fetchSingleIngredient = async (ingredient, retries = 3) => {
  const apiKeys = await getNaverApiKeys();
  console.log('네이버 API 호출 시작:', ingredient);

  for (let i = 0; i < retries; i++) {
    try {
      const query = encodeURIComponent(ingredient);
      const options = {
        hostname: 'openapi.naver.com',
        path: `/v1/search/shop.json?query=${query}&display=10&sort=sim`,
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': apiKeys.clientId,
          'X-Naver-Client-Secret': apiKeys.clientSecret,
          'User-Agent': 'AI-Chef/1.0'
        }
      };

      console.log('네이버 API 요청:', { hostname: options.hostname, path: options.path });

      const data = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            console.log('네이버 API 응답:', { statusCode: res.statusCode, bodyLength: body.length });
            if (res.statusCode === 429) {
              reject(new Error('RATE_LIMIT'));
              return;
            }
            if (res.statusCode !== 200) {
              console.error('네이버 API 에러 응답:', body);
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              console.error('JSON 파싱 에러:', e, 'Body:', body);
              reject(new Error('Invalid JSON response'));
            }
          });
        });
        req.on('error', (err) => {
          console.error('네이버 API 요청 에러:', err);
          reject(err);
        });
        req.setTimeout(10000, () => {
          console.error('네이버 API 타임아웃');
          reject(new Error('Request timeout'));
        });
        req.end();
      });

      console.log('네이버 API 응답 데이터:', { itemCount: data.items?.length || 0 });
      
      // 구매 가능한 상품만 필터링 (강화된 필터링)
      const availableItems = data.items.filter(item => {
        // 기본 필터링 조건
        const hasValidPrice = item.lprice && parseInt(item.lprice) > 0;
        const hasValidTitle = item.title && item.title.trim().length > 0;
        const hasValidLink = item.link && item.link.trim().length > 0;
        
        // 품절 키워드 체크 (제목에서)
        const title = item.title.replace(/<[^>]*>/g, '').toLowerCase();
        const isOutOfStock = title.includes('품절') || 
                           title.includes('판매중단') || 
                           title.includes('단종') ||
                           title.includes('sold out') ||
                           title.includes('out of stock') ||
                           title.includes('재고없음') ||
                           title.includes('일시품절');
        
        // 네이버 API 특정 필드 체크
        const hasValidMall = item.mallName && item.mallName.trim().length > 0;
        const hasValidProductId = item.productId && item.productId.trim().length > 0;
        
        // 가격 범위 체크 (너무 저렴하거나 비싼 상품 제외)
        const price = parseInt(item.lprice);
        const isPriceReasonable = price >= 100 && price <= 1000000; // 100원 ~ 100만원
        
        // 링크 유효성 체크 (기본적인 URL 형식)
        const isValidUrl = item.link.startsWith('http') && 
                          (item.link.includes('smartstore.naver.com') || 
                           item.link.includes('shopping.naver.com') ||
                           item.link.includes('coupang.com') ||
                           item.link.includes('gmarket.co.kr') ||
                           item.link.includes('11st.co.kr') ||
                           item.link.includes('auction.co.kr') ||
                           item.link.includes('ssg.com'));
        
        return hasValidPrice && 
               hasValidTitle && 
               hasValidLink && 
               hasValidMall &&
               hasValidProductId &&
               isPriceReasonable &&
               isValidUrl &&
               !isOutOfStock;
      });
      
      console.log('필터링 결과:', { 
        total: data.items?.length || 0, 
        available: availableItems.length,
        filtered: (data.items?.length || 0) - availableItems.length 
      });
      
      return availableItems
        .map(item => ({
          name: item.title.replace(/<[^>]*>/g, ''),
          price: parseInt(item.lprice) || 0,
          vendor: item.mallName,
          link: item.link,  // 네이버 API 제공 직접 구매 링크
          image: item.image || null,
          category: item.category1 || null,
          productId: item.productId || null,
          brand: item.brand || null,
          availability: 'available',
          maker: item.maker || null,
          hprice: parseInt(item.hprice) || null
        }))
        .sort((a, b) => a.price - b.price);
    } catch (error) {
      console.error(`네이버 API 호출 실패 (시도 ${i + 1}/${retries}):`, error.message);
      if (error.message === 'RATE_LIMIT' && i < retries - 1) {
        await delay(1000 * (i + 1));
        continue;
      }
      throw error;
    }
  }
};

const fetchIngredientPrices = async (ingredients) => {
  const promises = ingredients.map(ingredient => 
    fetchSingleIngredient(ingredient).catch(error => ({ error, ingredient }))
  );
  
  const results = await Promise.allSettled(promises);
  
  return results.reduce((acc, result, index) => {
    if (result.status === 'fulfilled' && !result.value.error) {
      acc[ingredients[index]] = result.value;
    }
    return acc;
  }, {});
};

module.exports = {
  fetchIngredientPrices,
  fetchSingleIngredient
};
