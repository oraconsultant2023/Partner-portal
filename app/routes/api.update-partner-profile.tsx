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

    // Make sure data.id is a full Shopify GID
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