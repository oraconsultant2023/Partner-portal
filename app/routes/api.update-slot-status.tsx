import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);
    if (!admin) return json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return json({ success: false, error: "Missing ID or Status" }, { status: 400 });
    }

    // Update the specific Metaobject.
    // Because inventory_status is a List field, it must be passed as a stringified array.
    const response = await admin.graphql(`
      mutation UpdateSlotStatus($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        id: id,
        metaobject: {
          fields: [
            { key: "inventory_status", value: JSON.stringify([status]) }
          ]
        }
      }
    });

    const data: any = await response.json();
    const errors = data?.data?.metaobjectUpdate?.userErrors;

    if (errors?.length > 0) {
      return json({ success: false, error: errors[0].message });
    }

    return json({ success: true });

  } catch (error: any) {
    console.error("Update Slot Status Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}