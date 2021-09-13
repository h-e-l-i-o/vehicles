const express = require('express')
const router = express.Router()
const fs = require('fs')
const Fuse = require('fuse.js')

const dataPath = './db/VehicleInfo.json' // path to our JSON file

const mongoObjectId = function () {
  const timestamp = (new Date().getTime() / 1000 | 0).toString(16)
  return timestamp + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function () {
    return (Math.random() * 16 | 0).toString(16)
  }).toLowerCase()
}

const getVehicleData = () => {
  const jsonData = fs.readFileSync(dataPath)
  return JSON.parse(jsonData)
}
const saveVehicleData = (data) => {
  const stringifyData = JSON.stringify(data)
  fs.writeFileSync(dataPath, stringifyData)
}
const getVehiclesPage = (filteredVehicles, page = 1, limit = 50) => {
  limit = process.env.PAGESIZE || limit
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const result = filteredVehicles.slice(startIndex, endIndex)
  return result
}
const fuzzySearch = (list, pattern) => {
  const options = {
    // isCaseSensitive: false,
    // includeScore: false,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 1,
    // location: 0,
    threshold: 0.6,
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    keys: [
      'title'
    ]
  }
  const fuse = new Fuse(list, options)
  return fuse.search(pattern)
}

/* browse vehicles. */
router.get('/', function (req, res, next) {
  const limit = process.env.PAGESIZE || 50
  const page = {}
  page.current = req.query.page ? Number(req.query.page) : 1
  page.next = page.current + 1
  page.previous = page.current - 1
  const filter = req.query.filter

  const allVehicles = getVehicleData()
  const extendedVehicles = allVehicles.map(vehicle => {
    vehicle.title = vehicle.make + vehicle.model + vehicle.year
    return vehicle
  })

  let filteredVehicles = extendedVehicles
  let filtered = false
  if (filter) {
    filteredVehicles = fuzzySearch(allVehicles, filter)
    filtered = true
  }
  const count = filteredVehicles.length

  const forward = (page.current * limit) < count
  const back = page.current > 1
  const vehicles = getVehiclesPage(filteredVehicles, page.current, limit)
  res.render('index', { count, vehicles, page, filter, filtered, forward, back })
})

// delete - using get method because delete not allowed from html
router.get('/delete/:oid', (req, res) => {
  const messages = []
  const allVehicles = getVehicleData()
  const oid = req.params.oid
  const vehicleIndex = allVehicles.findIndex(vehicle => vehicle._id.$oid === oid)
  const vehicleFound = vehicleIndex > -1
  if (vehicleFound) {
    allVehicles.splice(vehicleIndex, 1)
    saveVehicleData(allVehicles)
    messages.push('Vehicle deleted')
  } else {
    messages.push('Vehicle not found')
  }
  res.render('deleted', { messages })
})

router.post('/', (req, res) => {
  const messages = []
  if (isNaN(req.body.year) || !req.body.year) messages.push('Year must be a number')
  if (!req.body.make) messages.push('Make is required')
  if (!req.body.model) messages.push('Model is required')
  if (messages.length > 0) return res.render('created', { messages })

  const allVehicles = getVehicleData()
  const checkDuplicate = () => {
    const vehicleIndex = allVehicles.findIndex(vehicle => {
      return (
        vehicle.make.toUpperCase() === req.body.make.toUpperCase() &&
        vehicle.model.toUpperCase() === req.body.model.toUpperCase() &&
        vehicle.year === Number(req.body.year)
      )
    })
    return vehicleIndex > -1
  }

  const vehicleExists = checkDuplicate()
  if (vehicleExists) {
    messages.push('Vehicle already exist')
  } else {
    allVehicles.push({
      _id: { $oid: mongoObjectId() },
      make: req.body.make.toUpperCase(),
      model: req.body.model.toUpperCase(),
      year: Number(req.body.year)
    })
    saveVehicleData(allVehicles)
    messages.push('Vehicle added succesfully')
  }
  res.render('created', { messages })
})

module.exports = router
