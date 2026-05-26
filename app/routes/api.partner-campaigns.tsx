import { json } from "@remix-run/node";
import { shopify }
from "../shopify.server";

const corsHeaders = {

  "Access-Control-Allow-Origin":
    "https://gimmethegoodstuff.org",

  "Access-Control-Allow-Methods":
    "GET, OPTIONS",

  "Access-Control-Allow-Headers":
    "Content-Type"

};

export async function loader({
  request
}: any) {

  try {

    const url =
      new URL(request.url);

    const email =
      url.searchParams.get("email");

    const category =
      url.searchParams.get("category");

    const sessions =
      await shopify.sessionStorage
        .findSessionsByShop(
          "skmkxe-bi.myshopify.com"
        );

    const session =
      sessions[0];

    const client =
      new shopify.api.clients.Graphql({
        session
      });

    const response =
      await client.query({

        data: {

          query: `

            query {

              metaobjects(
                type: "partner_campaign",
                first: 50
              ) {

                edges {

                  node {

                    id

                    fields {

                      key
                      value

                    }

                  }

                }

              }

            }

          `

        }

      });

    const campaigns =
      response.body.data
        .metaobjects.edges
        .map((edge: any) => {

          const fields =
            edge.node.fields
              .reduce(
                (
                  acc: any,
                  field: any
                ) => {

                  acc[field.key] =
                    field.value;

                  return acc;

                },
                {}
              );

          return fields;

        })
        .filter((campaign: any) => {

          // GLOBAL
          if (
            campaign.campaign_type ===
            "global"
          ) {

            return true;

          }

          // PRIVATE
          if (
            campaign.campaign_type ===
            "private" &&
            campaign.partner_email ===
            email
          ) {

            return true;

          }

          // CATEGORY
          if (
            campaign.campaign_type ===
            "category" &&
            campaign.target_category ===
            category
          ) {

            return true;

          }

          return false;

        });

    return json(
      {
        success: true,
        campaigns
      },
      {
        headers: corsHeaders
      }
    );

  } catch(error: any) {

    console.log(error);

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

export async function options() {

  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });

}