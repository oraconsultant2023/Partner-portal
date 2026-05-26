import { json }
from "@remix-run/node";

import {
  authenticate
} from "../shopify.server";

export async function loader({
  request
}: any) {

  try {

    // AUTH SHOPIFY ADMIN
    const { admin } =
      await authenticate.admin(
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

    // GRAPHQL QUERY
    const response =
      await admin.graphql(`

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

      `);

    const result =
      await response.json();

    console.log(
      "GRAPHQL RESULT:",
      JSON.stringify(
        result,
        null,
        2
      )
    );

    // SAFETY CHECK
    if (
      !result.data ||
      !result.data.metaobjects
    ) {

      return json([]);

    }

    // FORMAT CAMPAIGNS
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