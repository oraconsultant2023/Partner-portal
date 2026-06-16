import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ success: false, error: "Unauthorized access" }, { status: 401 });

  try {
    // Extract the campaign ID from the URL parameters instead of the body
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");

    if (!campaignId) {
      return json({ success: false, error: "Campaign ID is missing." }, { status: 400 });
    }

    const mutation = `
      mutation DeleteCampaign($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    const formattedId = campaignId.includes('gid://') 
      ? campaignId 
      : `gid://shopify/Metaobject/${campaignId}`;

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