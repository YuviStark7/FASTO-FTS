/** DOM id of a fact row; `scope` keeps ids unique when several answers share a page. Kept apart from the zod readers so client bundles stay small. */
export const factAnchor = (scope: string, id: string) => `${scope}-${id}`;
