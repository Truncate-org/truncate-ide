
export type ColumnType = 'string' | 'number' | 'date' | 'boolean';

// Infer column types based on the first few rows of data
// DEPRECATED: We now use backend types. Keeping this comments or removing entirely.
// Removing entire function.

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
    columnIndex: number;
    direction: SortDirection;
}

export interface FilterCondition {
    operator: string;
    value: string;
    value2?: string; // For 'between'
}

export type FilterState = Record<number, FilterCondition[]>;

export function processRows(
    rows: string[][],
    columnTypes: ColumnType[],
    sortState: SortState | null,
    filterState: FilterState,
    globalSearch: string
): string[][] {
    let result = [...rows];

    // 1. Apply Global Search
    if (globalSearch && globalSearch.trim() !== '') {
        const searchLower = globalSearch.toLowerCase();
        result = result.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(searchLower))
        );
    }

    // 2. Apply Column Filters
    if (Object.keys(filterState).length > 0) {
        result = result.filter(row => {
            return Object.entries(filterState).every(([colIdxStr, conditions]) => {
                const colIdx = parseInt(colIdxStr);
                const cellValue = row[colIdx];
                const type = columnTypes[colIdx];

                if (conditions.length === 0) return true;

                // Pass if ANY condition matches (OR logic within column? Usually AND for multi-conditions, but let's stick to standard)
                // Actually usually filters are implicit AND across columns, but within a column?
                // Google Sheets: "Filter by condition" is usually single condition. 
                // Let's assume single condition per column for now based on UI requirements, but array structure allows expansion.
                // If multiple conditions exist for one column, we'll treat them as logical AND.

                return conditions.every(condition => checkCondition(cellValue, type, condition));
            });
        });
    }

    // 3. Apply Sort
    if (sortState && sortState.direction) {
        const { columnIndex, direction } = sortState;
        const type = columnTypes[columnIndex];

        result.sort((a, b) => {
            const valA = a[columnIndex];
            const valB = b[columnIndex];

            if (valA === valB) return 0;
            if (valA === 'NULL' || valA === null) return 1; // Nulls last
            if (valB === 'NULL' || valB === null) return -1;

            let comparison = 0; // 0 equal, -1 A<B, 1 A>B

            if (type === 'number') {
                comparison = Number(valA) - Number(valB);
            } else if (type === 'date') {
                comparison = Date.parse(valA) - Date.parse(valB);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    return result;
}

function checkCondition(val: string, type: ColumnType, condition: FilterCondition): boolean {
    const { operator, value, value2 } = condition;

    // Handle NULLs
    if (val === 'NULL' || val === null) {
        // Only allow if we specifically valid specific null checks if we implemented them
        return operator === 'empty';
    }

    if (type === 'number') {
        const numVal = Number(val);
        const filterVal = Number(value);

        if (isNaN(numVal)) return false;

        switch (operator) {
            case 'eq': return numVal === filterVal;
            case 'gt': return numVal > filterVal;
            case 'lt': return numVal < filterVal;
            case 'between': return numVal >= filterVal && numVal <= Number(value2);
            default: return true;
        }
    } else if (type === 'date') {
        const dateVal = Date.parse(val);
        const filterDate = Date.parse(value);

        if (isNaN(dateVal)) return false;

        switch (operator) {
            case 'before': return dateVal < filterDate;
            case 'after': return dateVal > filterDate;
            case 'between': return dateVal >= filterDate && dateVal <= Date.parse(value2 || '');
            default: return true;
        }
    } else {
        // String / Boolean
        const strVal = String(val).toLowerCase();
        const filterStr = String(value).toLowerCase();

        switch (operator) {
            case 'contains': return strVal.includes(filterStr);
            case 'eq': return strVal === filterStr;
            case 'starts_with': return strVal.startsWith(filterStr);
            case 'ends_with': return strVal.endsWith(filterStr);
            default: return true;
        }
    }
}
