import { json }
from "@remix-run/node";

import shopify
from "../shopify.server";

export async function loader({
  request
}: any) {

  try {

    // GET URL PARAMS
    const url =
      new URL(request.url);

    const email =
      url.searchParams.get(
        "email"
      );

    const category =
      url.searchParams.get(
        "category"
      );

    console.log(
      "EMAIL:",
      email
    );

    console.log(
      "CATEGORY:",
      category
    );

    // GET SHOP SESSION
    const sessions =
      await shopify.sessionStorage.findSessionsByShop(
        "skmkxe-bi.myshopify.com"
      );

    if (!sessions.length) {

      return json([]);

    }

    const session =
      sessions[0];

    // GRAPHQL REQUEST
    const response =
      await fetch(

        `https://partner-portal-ten-livid.vercel.app/api/partner-campaigns?email=${email}&category=${category}`,

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",
"X-Shopify-Access-Token":
  String(session.accessToken)

          },

          body: JSON.stringify({

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

          })

        }

      );

    const result =
      await response.json();

    console.log(
      "GRAPHQL:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    // FORMAT DATA
    const campaigns =
      result.data.metaobjects.edges
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

            ...fields

          };

        });

    // FILTER CAMPAIGNS
    const filteredCampaigns =
      campaigns.filter(
        (campaign: any) => {

          // GLOBAL
          if (
            campaign.campaign_type ===
            "global"
          ) {

            return true;

          }

          // PRIVATE EMAIL
          if (

            campaign.campaign_type ===
            "private"

            &&

            campaign.partner_email ===
            email

          ) {

            return true;

          }

          // CATEGORY
          if (

            campaign.campaign_type ===
            "category"

            &&

            campaign.target_category ===
            category

          ) {

            return true;

          }

          return false;

        }
      );

    console.log(
      "FILTERED:",
      filteredCampaigns
    );

    return json(
      filteredCampaigns
    );

  } catch(error: any) {

    console.log(
      "CAMPAIGN ERROR:",
      error
    );

    return json([]);

  }

}