module.exports = (sequelize, DataTypes) => {
  const isSQLite = sequelize.options.dialect === 'sqlite'

  const Seller = sequelize.define(
    'Seller',
    {
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      superuser: DataTypes.BOOLEAN,
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      data: {
        type: isSQLite ? DataTypes.JSON : DataTypes.JSONB,
        defaultValue: {}
      }
    },
    {
      underscored: true,
      tableName: 'sellers'
    }
  )

  Seller.associate = function (models) {
    Seller.belongsToMany(models.Shop, { through: models.SellerShop })
  }

  return Seller
}
