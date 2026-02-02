// Mock implementation of react-native-html-to-pdf
module.exports = {
  convert: async (options) => {
    // Return a mock PDF file path
    return {
      filePath: `/tmp/prescriptions_${Date.now()}.pdf`
    };
  }
};
