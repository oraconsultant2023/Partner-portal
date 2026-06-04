import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    const { requestId } = await request.json();
    
    // FIXED: Ensure GID format
    const safeRequestId = requestId.includes("gid://") ? requestId : `gid://shopify/Metaobject/${requestId}`;

    const updateRequestRes = await admin.graphql(
      `mutation UpdateRequest($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: safeRequestId,
          metaobject: { fields: [{ key: "status", value: "Rejected" }] }
        }
      }
    );

    const requestUpdateData = await updateRequestRes.json();
    const requestErrors = requestUpdateData.data?.metaobjectUpdate?.userErrors || [];
    if (requestErrors.length > 0) throw new Error("Request Update Error: " + requestErrors[0].message);

    return json({ success: true, message: "Rejected successfully" });
  } catch (error: any) {
    console.error("REJECT REQUEST ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}