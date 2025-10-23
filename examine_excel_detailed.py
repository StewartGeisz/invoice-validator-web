import pandas as pd

def examine_excel_detailed():
    """Detailed examination of the Excel file including all sheets"""
    try:
        # Check all sheets in the Excel file
        xl_file = pd.ExcelFile('Service Agreement Table.xlsx')
        print("Available sheets:", xl_file.sheet_names)
        
        for sheet_name in xl_file.sheet_names:
            print(f"\n{'='*50}")
            print(f"Sheet: {sheet_name}")
            print(f"{'='*50}")
            
            df = pd.read_excel('Service Agreement Table.xlsx', sheet_name=sheet_name)
            print(f"Rows: {len(df)}, Columns: {len(df.columns)}")
            
            print("\nColumn names:")
            for i, col in enumerate(df.columns):
                # Convert to Excel column letter
                col_letter = ""
                num = i + 1
                while num > 0:
                    num -= 1
                    col_letter = chr(65 + (num % 26)) + col_letter
                    num //= 26
                print(f"Column {col_letter} (index {i}): {col}")
            
            # Look for PO-related columns
            po_columns = [col for col in df.columns if 'PO' in str(col).upper() or 'PURCHASE' in str(col).upper()]
            if po_columns:
                print(f"\nPO-related columns found: {po_columns}")
            
            # Look for date-related columns
            date_columns = [col for col in df.columns if 'DATE' in str(col).upper() or 'START' in str(col).upper() or 'END' in str(col).upper()]
            if date_columns:
                print(f"\nDate-related columns found: {date_columns}")
            
            # Look for amount-related columns
            amount_columns = [col for col in df.columns if 'AMOUNT' in str(col).upper() or 'BUDGET' in str(col).upper() or '$' in str(col)]
            if amount_columns:
                print(f"\nAmount-related columns found: {amount_columns}")
            
            # Show sample data for key columns
            if len(df) > 0:
                print(f"\nFirst 3 rows of data:")
                print(df.head(3))
        
    except Exception as e:
        print(f"Error reading Excel file: {e}")

if __name__ == "__main__":
    examine_excel_detailed()