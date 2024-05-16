const express = require('express')
const app = express()
const path = require('path')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null
const initializedbserver = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running at http:/localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error is ${e.message}`)
    process.exit(1)
  }
}
initializedbserver()
app.post('/user/', async (request, response) => {
  const {username, name, password, gender, location} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const query = `select * from user where username='${username}'`
  const dbuser = await db.get(query)
  if (dbuser === undefined) {
    const query2 = `insert into user(username,name,password,gender,location)values('${username}','${name}','${hashedPassword}','${gender}','${location}')`
    await db.run(query2)
    response.send('successfully Registered')
  } else {
    response.status(400)
    response.send('User already registered')
  }
})
const authenticationheader = (request, response, next) => {
  let jwttoken
  const authheader = request.headers['authorization']
  if (authheader !== undefined) {
    jwttoken = authheader.split(' ')[1]
  }
  if (jwttoken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwttoken, 'bhanu', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const query = `select * from user where username='${username}'`
  const dbuser = await db.get(query)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispasswordmatched = await bcrypt.compare(password, dbuser.password)
    if (ispasswordmatched === true) {
      const payload = {username: username}
      const jwttoken = jwt.sign(payload, 'bhanu')
      response.send({jwttoken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
const convertstateobjecttoresponseobject = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}
const convertdistrictobjecttoresponseobject = dbobject => {
  return {
    districtId: dbobject.district_id,
    districtName: dbobject.district_name,
    cases: dbobject.cases,
    cured: dbobject.cured,
    active: dbobject.active,
    deaths: dbobject.deaths,
  }
}
app.get('/states/', authenticationheader, async (request, response) => {
  const query = `select * from state`
  const query2 = await db.all(query)
  response.send(
    query2.map(eachstate => convertstateobjecttoresponseobject(eachstate)),
  )
})
app.get(
  '/states/:stateId/',
  authenticationheader,
  async (request, response) => {
    const {stateId} = request.params
    const query = `select * from state where state_id=${stateId}`
    const query2 = await db.get(query)
    response.send(convertstateobjecttoresponseobject(query2))
  },
)
app.post('/districts/', authenticationheader, async (request, response) => {
  const bookdetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = bookdetails
  const query = `insert into district(district_name,state_id,cases,cured,active,deaths) values('${districtName}',${stateId},${cases},${cured},${active},${deaths})`
  await db.run(query)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId/',
  authenticationheader,
  async (request, response) => {
    const {districtId} = request.params
    const query = `select * from district where  district_id=${districtId}`
    const query2 = await db.get(query)
    response.send(convertdistrictobjecttoresponseobject(query2))
  },
)
app.delete(
  '/districts/:districtId/',
  authenticationheader,
  async (request, response) => {
    const {districtId} = request.params
    const query = `delete from district where district_id=${districtId}`
    await db.run(query)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticationheader,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const query = `update district set district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} where district_id=${districtId}`
    await db.run(query)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  authenticationheader,
  async (request, response) => {
    const {stateId} = request.params
    const query = `select SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive, SUM(deaths) as totalDeaths from district where state_id=${stateId} `
    const query2 = await db.get(query)
    response.send(query2)
  },
)
module.exports = app
