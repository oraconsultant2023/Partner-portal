import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {
  // 1. Authenticate via App Proxy
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const email = url.searchParams.get("email");
    const brand_name = url.searchParams.get("brand_name");

    if (!id || !email || !brand_name) {
       return json({ error: "Missing required parameters" }, { status: 400 });
    }

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

    // 3. CREATE CUSTOMER PROFILE (Now requesting the 'id' back)
    const customerResponse = await admin.graphql(
      `mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
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

    // ERROR CHECKING FOR CREATION
    const updateErrors = updateResult?.data?.metaobjectUpdate?.userErrors || [];
    const customerErrors = customerResult?.data?.customerCreate?.userErrors || [];

    if (updateErrors.length || customerErrors.length) {
      console.log("Creation Errors:", { updateErrors, customerErrors });
      return json({ success: false, updateErrors, customerErrors }, { status: 400 });
    }

    // 4. SEND ACCOUNT INVITE EMAIL
    const newCustomerId = customerResult?.data?.customerCreate?.customer?.id;
    
    if (newCustomerId) {
      const inviteResponse = await admin.graphql(
        `mutation customerSendAccountInviteEmail($customerId: ID!) {
          customerSendAccountInviteEmail(customerId: $customerId) {
            userErrors { field message }
          }
        }`,
        {
          variables: { customerId: newCustomerId }
        }
      );
      
      const inviteResult = await inviteResponse.json();
      const inviteErrors = inviteResult?.data?.customerSendAccountInviteEmail?.userErrors || [];

      // If the email fails to send for some reason, return the error to your popup
      if (inviteErrors.length) {
        console.log("Invite Errors:", inviteErrors);
        return json({ 
          success: false, 
          error: "Account created, but failed to send the invite email automatically.", 
          customerErrors: inviteErrors 
        }, { status: 400 });
      }
    }

    // 5. ULTIMATE SUCCESS
    return json({ success: true, message: "Application approved and invite sent!" });

  } catch (error: any) {
    console.log("APPROVE ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}