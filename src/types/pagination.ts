export interface PaginatedResponse<T> {
  items: T[]; // Array of items
  totalItems: number; // Total number of items matching the query
  currentPage: number; // Current page number
  totalPages: number; // Total number of pages
  nextPage: number | null; // Next page number, or null if no more pages
  limit:number;
}
