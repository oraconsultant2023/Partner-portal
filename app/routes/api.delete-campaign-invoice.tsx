import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ success: false, error: "Unauthorized access" }, { status: 401 });

  try {
    const data = await request.json();

    if (!data.campaignId) {
      return json({ success: false, error: "Campaign ID is missing." }, { status: 400 });
    }

    // This mutation deletes the ENTIRE metaobject entry
    const mutation = `
      mutation DeleteCampaign($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    const formattedId = data.campaignId.includes('gid://') 
      ? data.campaignId 
      : `gid://shopify/Metaobject/${data.campaignId}`;

    const response = await admin.graphql(mutation, { 
      variables: { id: formattedId } 
    });
    
    const result = await response.json();

    if (result.data?.metaobjectDelete?.userErrors?.length > 0) {
      return json({ success: false, error: result.data.metaobjectDelete.userErrors[0].message });
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("Delete Campaign Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}