import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const { requestId } = await request.json();

    // Helper function to ensure Shopify's strict GID format
    const formatGid = (id: string) => {
      if (!id) return id;
      return id.includes("gid://") ? id : `gid://shopify/Metaobject/${id}`;
    };

    const safeRequestId = formatGid(requestId);

    // 1. Update the Request Status to "Approved"
    const updateRequestRes = await admin.graphql(
      `mutation UpdateRequest($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: safeRequestId,
          metaobject: { fields: [{ key: "status", value: "Approved" }] }
        }
      }
    );

    const requestUpdateData = await updateRequestRes.json();
    const requestErrors = requestUpdateData.data?.metaobjectUpdate?.userErrors || [];
    if (requestErrors.length > 0) throw new Error("Request Update Error: " + requestErrors[0].message);

    // Note: The auto-booking logic for the Slot Inventory Status has been removed.
    // The slot will remain fully available until manually changed by the admin.

    return json({ success: true, message: "Request approved successfully." });
  } catch (error: any) {
    console.error("Approve Request Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}