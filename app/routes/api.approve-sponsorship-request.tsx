import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const { requestId, slotId } = await request.json();

    // FIXED: Helper function to ensure Shopify's strict GID format
    const formatGid = (id: string) => {
      if (!id) return id;
      return id.includes("gid://") ? id : `gid://shopify/Metaobject/${id}`;
    };

    const safeRequestId = formatGid(requestId);
    const safeSlotId = formatGid(slotId);

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

    // 2. Update the Slot Inventory Status to "Booked"
    if (safeSlotId) {
      const updateSlotRes = await admin.graphql(
        `mutation UpdateSlot($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            userErrors { field message }
          }
        }`,
        {
          variables: {
            id: safeSlotId,
            metaobject: { fields: [{ key: "inventory_status", value: JSON.stringify(["Booked"]) }] }
          }
        }
      );
      
      const slotUpdateData = await updateSlotRes.json();
      const slotErrors = slotUpdateData.data?.metaobjectUpdate?.userErrors || [];
      if (slotErrors.length > 0) throw new Error("Slot Update Error: " + slotErrors[0].message);
    }

    return json({ success: true, message: "Approved and slot booked successfully" });
  } catch (error: any) {
    console.error("APPROVE REQUEST ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}