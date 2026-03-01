/**
 * Assign category to a generic product name via Claude API.
 * Requires internet + working API. Throws on failure so the caller
 * can prevent adding the product with a wrong category.
 */

export interface CategoryAssignment {
  category_id: string;
  category_name: string;
}

export class CategoryAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryAssignmentError";
  }
}

export async function assignCategory(
  productName: string
): Promise<CategoryAssignment> {
  const res = await fetch("/api/assign-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CategoryAssignmentError(
      body.error ?? `Category assignment failed (${res.status})`
    );
  }

  const data = await res.json();
  if (!data.category_id) {
    throw new CategoryAssignmentError("No category returned from API");
  }

  return {
    category_id: data.category_id,
    category_name: data.category_name ?? "",
  };
}
