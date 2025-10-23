import pandas as pd
import sys

def examine_excel_structure():
    """Examine the Excel file structure to understand column layout"""
    try:
        # Read the Excel file
        df = pd.read_excel('Service Agreement Table.xlsx')
        
        print("Excel File Structure Analysis")
        print("="*50)
        print(f"Total rows: {len(df)}")
        print(f"Total columns: {len(df.columns)}")
        print("\nColumn names:")
        for i, col in enumerate(df.columns):
            print(f"Column {chr(65+i)} (index {i}): {col}")
        
        print("\nFirst few rows of relevant columns:")
        print("Column A (Vendor names):")
        print(df.iloc[:5, 0])  # Column A
        
        print("\nColumn E (Admin):")
        if len(df.columns) > 4:
            print(df.iloc[:5, 4])  # Column E
        
        print("\nColumn I (Manager):")
        if len(df.columns) > 8:
            print(df.iloc[:5, 8])  # Column I
        
        print("\nColumn AE (PO Start dates):")
        if len(df.columns) > 30:
            print(df.iloc[:5, 30])  # Column AE (31st column, 0-indexed as 30)
        
        print("\nColumn AF (PO End dates):")
        if len(df.columns) > 31:
            print(df.iloc[:5, 31])  # Column AF
        
        print("\nColumn AG (PO Numbers):")
        if len(df.columns) > 32:
            print(df.iloc[:5, 32])  # Column AG
        
        print("\nColumn AP (Expected amounts):")
        if len(df.columns) > 41:
            print(df.iloc[:5, 41])  # Column AP (42nd column, 0-indexed as 41)
        
        return df
        
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return None

if __name__ == "__main__":
    df = examine_excel_structure()