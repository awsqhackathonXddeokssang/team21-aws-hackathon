const https = require('https');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchSingleIngredient = async (ingredient, apiKeys, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const query = encodeURIComponent(ingredient);
      const options = {
        hostname: 'openapi.naver.com',
        path: `/v1/search/shop.json?query=${query}&display=10&sort=price`,
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': apiKeys.clientId,
          'X-Naver-Client-Secret': apiKeys.clientSecret,
          'User-Agent': 'AI-Chef/1.0'
        }
      };

      const data = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode === 429) {
              reject(new Error('RATE_LIMIT'));
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('Request timeout')));
        req.end();
      });

      return data.items.map(item => ({
        name: item.title.replace(/<[^>]*>/g, ''),
        price: parseInt(item.lprice) || 0,
        vendor: item.mallName,
        link: item.link
      }));
    } catch (error) {
      if (error.message === 'RATE_LIMIT' && i < retries - 1) {
        await delay(1000 * (i + 1));
        continue;
      }
      throw error;
    }
  }
};

const fetchIngredientPrices = async (ingredients, apiKeys) => {
  const promises = ingredients.map(ingredient => 
    fetchSingleIngredient(ingredient, apiKeys).catch(error => ({ error, ingredient }))
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
