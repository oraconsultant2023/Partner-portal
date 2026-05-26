import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {
  // 1. Authenticate via App Proxy
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    // 2. EXTRACT VARIABLES FROM URL INSTEAD OF BODY
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const email = url.searchParams.get("email");
    const brand_name = url.searchParams.get("brand_name");

    if (!id || !email || !brand_name) {
       return json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 3. UPDATE METAOBJECT STATUS
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
            fields: [{ key: "status", value: "approved" }]
          }
        }
      }
    );
    const updateResult = await updateResponse.json();

    // 4. CREATE CUSTOMER PROFILE
    const customerResponse = await admin.graphql(
      `mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            firstName: brand_name,
            lastName: "Partner",
            email,
            tags: ["partner"]
          }
        }
      }
    );
    const customerResult = await customerResponse.json();

    // 5. ERROR CHECKING
    const updateErrors = updateResult?.data?.metaobjectUpdate?.userErrors || [];
    const customerErrors = customerResult?.data?.customerCreate?.userErrors || [];

    if (updateErrors.length || customerErrors.length) {
      console.log("Errors:", { updateErrors, customerErrors });
      return json({ success: false, updateErrors, customerErrors }, { status: 400 });
    }

    return json({ success: true, message: "Application approved" });

  } catch (error: any) {
    console.log("APPROVE ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}