import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { 
      title, category, description, buttonText, 
      thumbName, thumbMime, thumbData, 
      fileName, fileMime, fileData 
    } = body;

    // =========================================================================
    // IMPORTANT FILE UPLOAD NOTE:
    // To attach actual files to a Metaobject via the GraphQL API, Shopify requires 
    // you to first upload them via the `stagedUploadsCreate` mutation, and then
    // create a File object to get a `gid://shopify/GenericFile/...` ID.
    // 
    // Assuming you have your staged upload logic built (similar to your invoices),
    // you would get your uploaded File GIDs here:
    // const uploadedThumbGid = await uploadToShopify(thumbData, thumbName, thumbMime, admin);
    // const uploadedFileGid = await uploadToShopify(fileData, fileName, fileMime, admin);
    // =========================================================================

    // For now, we will create the Metaobject. 
    // Replace the empty strings with your actual uploaded File GIDs.
    const uploadedThumbGid = ""; // e.g., "gid://shopify/MediaImage/123456789"
    const uploadedFileGid = "";  // e.g., "gid://shopify/GenericFile/987654321"

    const response = await admin.graphql(`
      mutation CreatePartnerResource($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "partner_resource",
          capabilities: {
            publishable: { status: "ACTIVE" }
          },
          fields: [
            { key: "title", value: title },
            { key: "category", value: category },
            { key: "description", value: description },
            { key: "button_text", value: buttonText },
            // If you have the GIDs, uncomment these lines to attach the files:
            // { key: "thumbnail", value: uploadedThumbGid },
            // { key: "file", value: uploadedFileGid }
          ]
        }
      }
    });

    const data = await response.json();
    const errors = data.data?.metaobjectCreate?.userErrors || [];

    if (errors.length > 0) {
      return json({ success: false, error: errors[0].message }, { status: 400 });
    }

    return json({ 
      success: true, 
      message: "Resource created successfully!",
      metaobject: data.data.metaobjectCreate.metaobject 
    });

  } catch (error: any) {
    console.error("UPLOAD RESOURCE ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}