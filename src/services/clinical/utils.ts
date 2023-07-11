export type ClinicalInput = {
	page: number;
	pageSize: number;
	sort: string;
	entityTypes: string[];
	donorIds: number[];
	submitterDonorIds: string[];
	completionState: string[];
};
/**
 * Get common query params out of the page, pageSize, and sort filters from clinical gql requests.
 * This string can be provided at the end of the url to provide the query parmas
 * @param filters
 */
export const buildClinicalInputQueryString = (filters: ClinicalInput): string => {
	const { page, pageSize, sort } = filters;

	const pageQuery = page !== undefined ? `page=${page}` : '';
	const pageSizeQuery = pageSize !== undefined ? `pageSize=${pageSize}` : '';
	const sortQuery = sort !== undefined ? `sort=${sort}` : '';
	return [pageQuery, pageSizeQuery, sortQuery].filter((query) => !!query).join('&');
};
