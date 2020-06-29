const get = require('lodash/get')
const fetch = require('node-fetch')

const { authSellerAndShop, authShop } = require('./_auth')
const encConf = require('../utils/encryptedConfig')
const { findOrder } = require('../utils/orders')
const { getLogger } = require('../utils/logger')

const log = getLogger('routes.printful')

const PrintfulURL = 'https://api.printful.com'

module.exports = function (app) {
  app.get(
    '/orders/:orderId/printful',
    authSellerAndShop,
    findOrder,
    async (req, res) => {
      const apiKey = await encConf.get(req.order.shopId, 'printful')
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Missing printful API configuration'
        })
      }
      const apiAuth = Buffer.from(apiKey).toString('base64')

      const result = await fetch(
        `${PrintfulURL}/orders/@${req.order.orderId}`,
        {
          headers: {
            'content-type': 'application/json',
            authorization: `Basic ${apiAuth}`
          }
        }
      )
      const json = await result.json()
      res.json(get(json, 'result'))
    }
  )

  app.post(
    '/orders/:orderId/printful/create',
    authSellerAndShop,
    async (req, res) => {
      const apiKey = await encConf.get(req.shop.id, 'printful')
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Missing printful API configuration'
        })
      }
      const apiAuth = Buffer.from(apiKey).toString('base64')
      const url = `${PrintfulURL}/orders${
        req.body.draft ? '' : '?confirm=true'
      }`

      const newOrderResponse = await fetch(url, {
        headers: {
          'content-type': 'application/json',
          authorization: `Basic ${apiAuth}`
        },
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify(req.body)
      })

      const text = await newOrderResponse.text()
      try {
        const json = JSON.parse(text)
        log.debug(json)

        if (!newOrderResponse.ok) {
          log.error('Attempt to create Printful order failed!')
          if (json && json.error) log.error(json.error.message)
          return res.status(json.code).json({
            success: false,
            message: json.error.message
          })
        }

        res.json({ success: true })
      } catch (e) {
        log.error('Error parsing Printful response')
        log.error(text)
        res.json({ success: false })
      }
    }
  )

  app.post(
    '/orders/:orderId/printful/confirm',
    authSellerAndShop,
    findOrder,
    async (req, res) => {
      const apiKey = await encConf.get(req.order.shopId, 'printful')
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'Missing printful API configuration'
        })
      }
      const apiAuth = Buffer.from(apiKey).toString('base64')

      const url = `${PrintfulURL}/orders/@${req.params.orderId}/confirm`
      const confirmOrderResponse = await fetch(url, {
        headers: {
          'content-type': 'application/json',
          authorization: `Basic ${apiAuth}`
        },
        credentials: 'include',
        method: 'POST'
      })
      const json = await confirmOrderResponse.json()
      log.debug(json)

      res.json({ success: true })
    }
  )

  app.post('/shipping', authShop, async (req, res) => {
    // console.log(req.body)
    const apiKey = await encConf.get(req.shop.id, 'printful')
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Service Unavailable'
      })
    }
    const apiAuth = Buffer.from(apiKey).toString('base64')

    const { recipient, items } = req.body

    const query = {
      recipient: {
        address1: recipient.address1,
        city: recipient.city,
        country_code: recipient.countryCode,
        state_code: recipient.provinceCode,
        zip: recipient.zip
      },
      items: items
        .map((i) => ({
          quantity: i.quantity,
          variant_id: i.variant
        }))
        .filter((i) => i.variant_id)
    }

    if (!query.items.length) {
      return res.json({ success: false })
    }

    const shippingRatesResponse = await fetch(`${PrintfulURL}/shipping/rates`, {
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${apiAuth}`
      },
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify(query)
    })
    const json = await shippingRatesResponse.json()
    if (json.result && Array.isArray(json.result)) {
      const shipping = json.result.map((rate) => {
        const [, label] = rate.name.match(/^(.*) \((.*)\)/)
        const min = rate.minDeliveryDays + 1
        const max = rate.maxDeliveryDays + 2
        return {
          id: rate.id,
          label,
          detail: `${min}-${max} business days`,
          amount: Number(rate.rate) * 100,
          countries: [recipient.countryCode]
        }
      })
      res.json(shipping)
    } else {
      res.json({ success: false })
    }
  })
}
