import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    // Extract ID from URL
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
        return json({ error: "Missing application ID" }, { status: 400 });
    }

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
      return json({ success: false, updateErrors }, { status: 400 });
    }

    return json({ success: true, message: "Application rejected" });

  } catch (error: any) {
    console.log("REJECT ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}