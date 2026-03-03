/**
 * Assign demand group to a generic product name via Claude API.
 * Requires internet + working API. Throws on failure so the caller
 * can prevent adding the product with a wrong category.
 */

export interface DemandGroupAssignment {
  demand_group_code: string;
  demand_group_name: string;
}

/** @deprecated Use DemandGroupAssignment. */
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

export async function assignDemandGroup(
  productName: string
): Promise<DemandGroupAssignment> {
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
  if (!data.demand_group_code) {
    throw new CategoryAssignmentError("No demand_group_code returned from API");
  }

  return {
    demand_group_code: data.demand_group_code,
    demand_group_name: data.demand_group_name ?? "",
  };
}

/** @deprecated Use assignDemandGroup. Wraps new API for backward compatibility. */
export async function assignCategory(
  productName: string
): Promise<CategoryAssignment> {
  const result = await assignDemandGroup(productName);
  return {
    category_id: result.demand_group_code,
    category_name: result.demand_group_name,
  };
}
