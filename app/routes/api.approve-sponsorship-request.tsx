import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const { requestId, slotId } = await request.json();

    // 1. Update the Request Status to "Approved"
    const updateRequestRes = await admin.graphql(
      `mutation UpdateRequest($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          id: requestId,
          metaobject: { fields: [{ key: "status", value: "Approved" }] }
        }
      }
    );

    // 2. Update the Slot Inventory Status to "Booked"
    if (slotId) {
      await admin.graphql(
        `mutation UpdateSlot($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            userErrors { message }
          }
        }`,
        {
          variables: {
            id: slotId,
            metaobject: { fields: [{ key: "inventory_status", value: JSON.stringify(["Booked"]) }] }
          }
        }
      );
    }

    return json({ success: true, message: "Approved and slot booked successfully" });
  } catch (error: any) {
    console.error("APPROVE REQUEST ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}