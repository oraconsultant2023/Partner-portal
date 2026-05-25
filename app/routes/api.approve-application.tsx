import { json } from "@remix-run/node";

export async function action({ request }: any) {

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
        { status: 401 }
      );

    }

    // BODY
    const body =
      await request.json();

    const {
      id,
      email,
      contact_name,
      brand_name
    } = body;

    // -----------------------------
    // 1. UPDATE METAOBJECT STATUS
    // -----------------------------

    await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-Shopify-Access-Token":
            process.env.SHOPIFY_ADMIN_TOKEN!
        },

        body: JSON.stringify({

          query: `

            mutation UpdateApplication($id: ID!) {

              metaobjectUpdate(

                id: $id,

                metaobject: {

                  fields: [
                    {
                      key: "status",
                      value: "approved"
                    }
                  ]

                }

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

          variables: {
            id
          }

        })

      }
    );

    // -----------------------------
    // 2. CREATE CUSTOMER
    // -----------------------------

    const customerResponse =
      await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Shopify-Access-Token":
              process.env.SHOPIFY_ADMIN_TOKEN!
          },

          body: JSON.stringify({

            query: `

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

            variables: {

              input: {

                firstName:
                  contact_name,

                email,

                tags: [
                  "partner"
                ]

              }

            }

          })

        }
      );

    const customerResult =
      await customerResponse.json();

    console.log(
      "CUSTOMER RESULT:",
      JSON.stringify(
        customerResult,
        null,
        2
      )
    );

    return json({

      success: true,

      message:
        "Application approved"

    });

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
      { status: 500 }
    );

  }

}