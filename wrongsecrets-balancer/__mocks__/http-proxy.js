const webProxy = jest.fn((req, res) => res.send('proxied'));

module.exports = {
  createProxyServer() {
    return {
      web: webProxy,
    };
  },
};
