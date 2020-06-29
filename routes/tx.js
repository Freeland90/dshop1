const { Event, Transaction } = require('../models')
const { authSellerAndShop, authRole } = require('./_auth')
const pick = require('lodash/pick')

module.exports = function (app) {
  app.get('/events', authSellerAndShop, authRole('admin'), async (req, res) => {
    const events = await Event.findAll({
      where: { shopId: req.shop.id }
    })
    res.json(events)
  })

  app.get('/transactions', authSellerAndShop, async (req, res) => {
    const transactions = await Transaction.findAll({
      where: { shopId: req.shop.id }
    })
    res.json(transactions)
  })

  app.get('/events/:txId', (req, res) => {
    const where = { transactionHash: req.params.txId }
    Event.findOne({ where }).then((event) => {
      res.json(pick(event, 'ipfsHash', 'transactionHash'))
    })
  })
}
