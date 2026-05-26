import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: any) {
  // 1. Authenticate via App Proxy (Bypasses CORS completely!)
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, email, brand_name } = body;

    // 2. UPDATE METAOBJECT STATUS
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

    // 3. CREATE CUSTOMER PROFILE
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

    // 4. ERROR CHECKING
    const updateErrors = updateResult?.data?.metaobjectUpdate?.userErrors || [];
    const customerErrors = customerResult?.data?.customerCreate?.userErrors || [];

    if (updateErrors.length || customerErrors.length) {
      console.log("Errors:", { updateErrors, customerErrors });
      return json({ success: false, updateErrors, customerErrors }, { status: 400 });
    }


    

    // 5. SUCCESS
    return json({ success: true, message: "Application approved" });

  } catch (error: any) {
    console.log("APPROVE ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}