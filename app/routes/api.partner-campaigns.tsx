import { json }
from "@remix-run/node";

import {
  authenticate
}
from "../shopify.server";

export async function loader({
  request
}: any) {

  try {

    // VALIDATE APP PROXY
    await authenticate.public.appProxy(
      request
    );

    // URL PARAMS
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

    // FETCH FROM STORE METAOBJECT API
    const response =
      await fetch(

`https://skmkxe-bi.myshopify.com/api/2025-04/graphql.json`,

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "X-Shopify-Storefront-Access-Token":
              process.env.SHOPIFY_STOREFRONT_TOKEN!

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
      result
    );

    if (
      !result.data ||
      !result.data.metaobjects
    ) {

      return json([]);

    }

    // FORMAT
    const campaigns =
      result.data.metaobjects.edges.map(
        (edge: any) => {

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

        }
      );

    // FILTER
    const filteredCampaigns =
      campaigns.filter(
        (campaign: any) => {

          if (
            campaign.campaign_type ===
            "global"
          ) {

            return true;

          }

          if (

            campaign.campaign_type ===
            "private"

            &&

            campaign.partner_email ===
            email

          ) {

            return true;

          }

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

    return json(
      filteredCampaigns
    );

  } catch(error: any) {

    console.log(
      "APP PROXY ERROR:",
      error
    );

    return json([]);

  }

}