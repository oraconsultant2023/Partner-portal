import { json } from "@remix-run/node";
import shopify 
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

    // GET SESSION
    const sessions =
      await shopify.sessionStorage
        .findSessionsByShop(
          "skmkxe-bi.myshopify.com"
        );

    const session =
      sessions[0];

    // GRAPHQL CLIENT
    const client =
      new shopify.api.clients.Graphql({
        session
      });

    // QUERY METAOBJECTS
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
                    handle

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

    const result =
      response.body;

    console.log(
      "CAMPAIGNS:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    const campaigns =
      result.data
        .metaobjects
        .edges
        .map((edge: any) => {

          const fields: any = {};

          edge.node.fields.forEach(
            (field: any) => {

              fields[field.key] =
                field.value;

            }
          );

          return {

            id:
              edge.node.id,

            handle:
              edge.node.handle,

            campaign_name:
              fields.campaign_name || "",

            campaign_type:
              fields.campaign_type || "",

            target_category:
              fields.target_category || "",

            partner_email:
              fields.partner_email || "",

            campaign_summary:
              fields.campaign_summary || "",

            budget:
              fields.budget || "",

            requirements:
              fields.requirements || "",

            placements:
              fields.placements || "",

            status:
              fields.status || "",

            start_date:
              fields.start_date || "",

            end_date:
              fields.end_date || ""

          };

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
      campaigns,
      {
        headers: corsHeaders
      }
    );

  } catch(error: any) {

    console.log(
      "CAMPAIGN ERROR:",
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

export async function options() {

  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });

}