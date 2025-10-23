import pandas as pd

# Load Excel file and check what PO numbers exist for our test vendors
df = pd.read_excel('Service Agreement Table.xlsx', sheet_name='Service Agreements')

print("Checking PO numbers for our test vendors:")
print("="*60)

test_vendors = ['Mid South', 'Budd Group', 'John Bouchard']

for vendor in test_vendors:
    print(f"\nSearching for vendor containing: '{vendor}'")
    
    # Find vendors that contain our search term
    matches = df[df['Vendor'].str.contains(vendor, case=False, na=False)]
    
    if len(matches) > 0:
        for idx, row in matches.iterrows():
            print(f"  Found: '{row['Vendor']}'")
            print(f"    Admin: {row['Admin']}")
            print(f"    Manager: {row['Main Contact']}")
            print(f"    Current PO: {row['Current PO']}")
            print(f"    PO Start: {row['PO Start']}")
            print(f"    PO End: {row['PO End']}")
    else:
        print(f"  No matches found for '{vendor}'")

print("\n" + "="*60)
print("Test file PO numbers extracted:")
print("  12628 Mid South P26003063.pdf → P26003063")
print("  230006 The Budd Group P26000686.pdf → P26000686") 
print("  25-23487 John Bouchard P25063542.pdf → P25063542")