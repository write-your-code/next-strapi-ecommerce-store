"use strict";
const stripe = require("stripe")(process.env.STRIPE_KEY);
/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products } = ctx.request.body;
    // console.log("products in strapi:", products);
    const lineItems = await Promise.all(
      products.map(async (product) => {
        const dbProduct = await strapi
          .service("api::product.product")
          .findOne(product.id);
        //   console.log('image found',dbProduct.thumbnail.data.attributes.url)
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: dbProduct.name,
                images: [product.thumbnail.data.attributes.url],
                // description: dbProduct.description,
              // multiply by 100 as stripe take price as cent
            },
            unit_amount: dbProduct.price * 100,
          },
          quantity: product.quantity,
        };
      })
    );
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        // success_url: `${process.env.CLIENT_URL}/success=true`,
        success_url: `${process.env.CLIENT_URL}/success`,
        cancel_url: `${process.env.CLIENT_URL}?canceled=true`,
        line_items: lineItems,
        shipping_address_collection: {
          allowed_countries: ["IN", "US"],
        },
        payment_method_types: ["card"],
      });

      await strapi
        .service("api::order.order")
        .create({ data: { products, stripeId: session.id } });

      return { stripeSession: session };
    } catch (err) {
      ctx.response.status = 500;
      console.log("error: " + err.message);
      return err;
    }
  },
}));
