import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ success: false, error: "Unauthorized access" }, { status: 401 });

  try {
    // 1. Extract the data from the URL search params instead of the body
    const url = new URL(request.url);
    const dataString = url.searchParams.get("data");
    
    if (!dataString) {
      return json({ success: false, error: "Missing payload data." }, { status: 400 });
    }
    
    const data = JSON.parse(dataString);

    if (!data.id) {
      return json({ success: false, error: "Application ID is missing." }, { status: 400 });
    }

    const mutation = `
      mutation UpdatePartnerProfile($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `;

    // Ensure it's a valid Shopify GID
    const formattedId = data.id.includes('gid://') ? data.id : `gid://shopify/Metaobject/${data.id}`;

    const variables = {
      id: formattedId,
      metaobject: {
        fields: [
          { key: "brand_name", value: data.brand_name || "" },
          { key: "contact_name", value: data.contact_name || "" },
          { key: "website", value: data.website || "" },
          { key: "category", value: data.category || "" },
          { key: "affiliate_program", value: data.affiliate_program || "false" },
          { key: "affiliate_link", value: data.affiliate_link || "" }
        ]
      }
    };

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.metaobjectUpdate?.userErrors?.length > 0) {
      return json({ success: false, error: result.data.metaobjectUpdate.userErrors[0].message });
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("Update Partner Profile Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}