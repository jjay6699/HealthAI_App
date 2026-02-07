# OpenAI Integration - Bloodwork Analysis & Nutrition Recommendations

## Overview
This app now includes AI-powered bloodwork analysis using OpenAI's GPT-4o model. The system analyzes blood test results and provides personalized nutrition recommendations from your product catalog.

## Features Implemented

### 1. **Bloodwork Analysis**
- Analyzes blood test markers (hemoglobin, vitamin D, iron, cholesterol, etc.)
- Provides overall health summary
- Identifies areas of concern
- Highlights positive findings
- Generates detailed insights by health category

### 2. **Nutrition Recommendations**
- AI recommends nutrition products from your 26-product catalog
- Recommendations include:
  - Priority level (high/medium/low)
  - Specific reasons based on bloodwork
  - Suggested dosage
  - Key benefits and nutrients

### 3. **User Flow**
1. **Upload Screen** → User uploads bloodwork or tries demo analysis
2. **AI Processing** → OpenAI analyzes the data
3. **Insights Screen** → Displays health analysis and findings
4. **Nutrition Screen** → Shows personalized nutrition recommendations

## Files Created/Modified

### New Files:
- `.env` - Environment configuration with OpenAI API key
- `.env.example` - Template for environment variables
- `src/services/openai.ts` - OpenAI service for bloodwork analysis
- `src/data/supplements.ts` - Complete nutrition catalog (26 products)
- `OPENAI_INTEGRATION.md` - This documentation

### Modified Files:
- `src/screens/upload/UploadScreen.tsx` - Added demo analysis and file upload
- `src/screens/insights/InsightsScreen.tsx` - Displays AI-generated insights
- `src/screens/supplements/SupplementsScreen.tsx` - Shows personalized nutrition recommendations

## How to Use

### Try the Demo:
1. Navigate to the **Upload** screen
2. Click **"Analyze Sample Bloodwork"** button
3. Wait for AI analysis (takes 5-10 seconds)
4. View results in **Insights** and **Nutrition** screens

### Upload Real Bloodwork:
1. Go to **Upload** screen
2. Click "Upload PDF or image" or "Upload CSV"
3. Select your bloodwork file
4. AI will analyze and provide recommendations

## Technical Details

### OpenAI Configuration:
- **Model**: GPT-4o (latest)
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Response Format**: JSON for structured data
- **API Key**: Stored in `.env` file

### Sample Bloodwork Data:
The demo uses realistic sample data including:
- Hemoglobin: 13.5 g/dL
- Vitamin D: 22 ng/mL (low)
- Iron: 65 μg/dL
- Cholesterol markers
- And more...

### Nutrition Catalog:
All 26 nutrition products from your list are included:
- Wheatgrass Powder, Chia Seed, Beetroot Powder
- Spirulina, Chlorella, Moringa
- Turmeric, Ginger, Matcha
- Collagen, Mushroom blends
- And 16 more...

## Security Notes

⚠️ **Important**: The current implementation uses `dangerouslyAllowBrowser: true` which allows the OpenAI API to be called directly from the browser. 

**For Production:**
- Move API calls to a backend server
- Never expose API keys in client-side code
- Implement proper authentication
- Add rate limiting

## Future Enhancements

1. **File Parsing**: Implement actual PDF/CSV parsing for uploaded files
2. **User Profiles**: Store user data and history
3. **Backend API**: Move OpenAI calls to secure backend
4. **Progress Tracking**: Track nutrition usage and re-test results
5. **Shopping Cart**: Add e-commerce functionality
6. **Doctor Integration**: Allow sharing results with healthcare providers

## API Usage

The app makes OpenAI API calls for:
- Bloodwork analysis (~1000-2000 tokens per request)
- Health insights generation (~500-1000 tokens per request)

**Estimated Cost**: ~$0.01-0.03 per analysis with GPT-4o

## Testing

To test the integration:
1. Ensure dev server is running: `npm run dev`
2. Navigate to http://localhost:5173
3. Login with demo credentials
4. Go to Upload screen
5. Click "Analyze Sample Bloodwork"
6. Check Insights and Nutrition screens

## Support

For issues or questions about the OpenAI integration, check:
- OpenAI API documentation: https://platform.openai.com/docs
- Console logs for detailed error messages
- Network tab for API request/response details


