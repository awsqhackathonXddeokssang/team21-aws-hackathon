const formatStandardResponse = (success, data, error = null, metadata = {}) => ({
  success,
  data: success ? data : null,
  error: error ? {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'An error occurred',
    details: error.details || {}
  } : null,
  metadata: {
    timestamp: new Date().toISOString(),
    requestId: metadata.requestId || require('crypto').randomUUID(),
    processingTime: metadata.processingTime || 0,
    ...metadata
  }
});

const calculateOptimalVendor = (ingredientPrices) => {
  const vendorCombinations = {};
  
  Object.entries(ingredientPrices).forEach(([ingredient, items]) => {
    items.forEach(item => {
      if (!vendorCombinations[item.vendor]) {
        vendorCombinations[item.vendor] = { items: [], totalPrice: 0, count: 0 };
      }
      vendorCombinations[item.vendor].items.push({ ingredient, ...item });
      vendorCombinations[item.vendor].totalPrice += item.price;
      vendorCombinations[item.vendor].count++;
    });
  });

  return Object.entries(vendorCombinations)
    .sort((a, b) => b[1].count - a[1].count || a[1].totalPrice - b[1].totalPrice)
    .slice(0, 3)
    .map(([vendor, data]) => ({
      vendor,
      items: data.items,
      totalPrice: data.totalPrice,
      itemCount: data.count
    }));
};

const formatPricingResult = (ingredientPrices, metadata = {}) => {
  const totalIngredients = Object.keys(ingredientPrices).length;
  const foundIngredients = Object.values(ingredientPrices).filter(items => items.length > 0).length;
  
  const data = {
    summary: {
      totalIngredients,
      foundIngredients,
      successRate: totalIngredients > 0 ? (foundIngredients / totalIngredients) : 0
    },
    ingredients: ingredientPrices,
    recommendations: {
      optimalVendors: calculateOptimalVendor(ingredientPrices),
      totalEstimatedCost: Object.values(ingredientPrices)
        .flat()
        .reduce((sum, item) => sum + (item.price || 0), 0)
    }
  };

  return formatStandardResponse(foundIngredients > 0, data, null, metadata);
};

module.exports = { formatPricingResult, formatStandardResponse };
