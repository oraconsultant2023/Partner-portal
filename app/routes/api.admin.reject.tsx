import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: any) {
  // 1. Authenticate via App Proxy
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body; // We only need the Metaobject ID to reject it

    // 2. UPDATE METAOBJECT STATUS TO "REJECTED"
    const updateResponse = await admin.graphql(
      `mutation updateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id,
          metaobject: {
            fields: [{ key: "status", value: "rejected" }]
          }
        }
      }
    );
    
    const updateResult = await updateResponse.json();
    const updateErrors = updateResult?.data?.metaobjectUpdate?.userErrors || [];

    if (updateErrors.length) {
      console.log("Errors:", { updateErrors });
      return json({ success: false, updateErrors }, { status: 400 });
    }

    // 3. SUCCESS
    return json({ success: true, message: "Application rejected" });

  } catch (error: any) {
    console.log("REJECT ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}