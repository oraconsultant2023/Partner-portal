import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://gimmethegoodstuff.org",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Access-Control-Allow-Headers":
    "Content-Type, x-admin-secret",
};

export async function options() {

  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });

}
export async function action({ request }: any) {

  // SHOPIFY AUTH
  const { admin } =
    await authenticate.admin(request);

  try {

    // SECRET CHECK
    const key =
      request.headers.get(
        "x-admin-secret"
      );

    if (
      key !== process.env.ADMIN_API_SECRET
    ) {

      return json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: corsHeaders,
        }
      );

    }

    // BODY
    const body =
      await request.json();

    const {
      id,
      email,
      contact_name,
      brand_name,
    } = body;

    // -----------------------------------
    // 1. UPDATE METAOBJECT STATUS
    // -----------------------------------

    const updateResponse =
      await admin.graphql(`

        mutation updateMetaobject(
          $id: ID!,
          $metaobject: MetaobjectUpdateInput!
        ) {

          metaobjectUpdate(
            id: $id,
            metaobject: $metaobject
          ) {

            metaobject {
              id
            }

            userErrors {
              field
              message
            }

          }

        }

      `,
      {
        variables: {

          id,

          metaobject: {

            fields: [

              {
                key: "status",
                value: "approved"
              }

            ]

          }

        }
      });

    const updateResult =
      await updateResponse.json();

    console.log(
      "FULL UPDATE RESULT:",
      JSON.stringify(
        updateResult,
        null,
        2
      )
    );

    // -----------------------------------
    // 2. CREATE CUSTOMER
    // -----------------------------------

    const customerResponse =
      await admin.graphql(`

        mutation customerCreate(
          $input: CustomerInput!
        ) {

          customerCreate(
            input: $input
          ) {

            customer {

              id
              email

            }

            userErrors {
              field
              message
            }

          }

        }

      `,
      {
        variables: {

          input: {

            firstName:
              contact_name || brand_name,

            lastName:
              "Partner",

            email,

            tags: [
              "partner"
            ]

          }

        }
      });

    const customerResult =
      await customerResponse.json();

    console.log(
      "FULL CUSTOMER RESULT:",
      JSON.stringify(
        customerResult,
        null,
        2
      )
    );

    // -----------------------------------
    // 3. CHECK ERRORS
    // -----------------------------------

    const updateErrors =
      updateResult?.data
        ?.metaobjectUpdate
        ?.userErrors || [];

    const customerErrors =
      customerResult?.data
        ?.customerCreate
        ?.userErrors || [];

    if (
      updateErrors.length ||
      customerErrors.length
    ) {

      return json(
        {

          success: false,

          updateErrors,

          customerErrors

        },
        {
          headers: corsHeaders
        }
      );

    }

    // -----------------------------------
    // SUCCESS
    // -----------------------------------

    return json(
      {

        success: true,

        message:
          "Application approved"

      },
      {
        headers: corsHeaders
      }
    );

  } catch(error: any) {

    console.log(
      "APPROVE ERROR:",
      error
    );

    return json(
      {
        success: false,
        error: error.message
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );

  }

}