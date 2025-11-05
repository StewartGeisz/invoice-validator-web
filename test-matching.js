const vendorData = require('./data/vendor-data.json');

// Simulate the loose matching logic
function testVendorMatch(pdfText) {
    const vendorList = vendorData.vendors;
    console.log('Testing vendor matching with text sample...');
    console.log('PDF Text sample:', pdfText.substring(0, 300));
    
    const pdfTextLower = pdfText.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    const allMatches = [];
    
    for (const vendor of vendorList) {
        const vendorLower = vendor.toLowerCase();
        
        // First, try direct substring match
        if (pdfTextLower.includes(vendorLower)) {
            console.log(`DIRECT MATCH FOUND: "${vendor}"`);
            return vendor;
        }
        
        // Then try word-based matching with better scoring
        const vendorWords = vendorLower
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && 
                !['inc', 'llc', 'corp', 'ltd', 'the', 'and', 'of', 'for', 'services', 'service', 'company', 'co'].includes(word));
        
        if (vendorWords.length === 0) continue;
        
        // Calculate weighted score - longer, more specific words get higher weight
        let totalWeight = 0;
        let matchedWeight = 0;
        
        for (const word of vendorWords) {
            const weight = Math.max(1, word.length - 2); // Longer words get more weight
            totalWeight += weight;
            
            if (pdfTextLower.includes(word)) {
                matchedWeight += weight;
            }
        }
        
        const score = totalWeight > 0 ? (matchedWeight / totalWeight) : 0;
        
        // Track all matches above threshold
        if (score >= 0.7 && vendorWords.length >= 2) {
            const matchedWords = vendorWords.filter(word => pdfTextLower.includes(word));
            if (matchedWords.length >= 2) {
                allMatches.push({
                    vendor,
                    score,
                    matchedWords,
                    vendorWords
                });
                
                if (score > bestScore) {
                    bestMatch = vendor;
                    bestScore = score;
                }
            }
        }
    }
    
    console.log('\nAll matches found:');
    allMatches.forEach(match => {
        console.log(`- ${match.vendor}: ${(match.score * 100).toFixed(1)}% (matched: ${match.matchedWords.join(', ')})`);
    });
    
    if (bestMatch) {
        console.log(`\nBest match: "${bestMatch}" (${Math.round(bestScore * 100)}%)`);
        return bestMatch;
    }
    
    console.log('\nNo matches found');
    return null;
}

// Test with Mid South PDF text sample
const midSouthText = `Invoice
Date
8/23/2025
Invoice #
12628
Bill To
Vanderbilt University
Disbursement Services
VU Station B #351810
2301 Vanderbilt Place
Nashville, TN 37235-1810180041
Ship To
Vanderbilt University
Power Plant
320 24th Avenue South
Nashville, TN 37240
P.O. Number
P26003063
Date
Description
Hours
Rate
Amount
08/16/25 - 08/22/25
Weekly Controls work for powerhouse
1
$ 10,942.20
$ 10,942.20
Mid South Instrument Services, Inc.
320 Industrial Blvd
Tuscaloosa, AL 35405
(205) 345-9777
Page 1`;

console.log('=== TESTING MID SOUTH MATCHING ===');
testVendorMatch(midSouthText);