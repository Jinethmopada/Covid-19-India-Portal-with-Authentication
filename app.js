const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const loginDetailsQuery = `select * from user 
    where username = '${username}';`;
  const loginDetailsResponse = await db.get(loginDetailsQuery);
  if (loginDetailsResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      loginDetailsResponse.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "jineth_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.status("Invalid password");
    }
  }
});

//Authentication with Token

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "jineth_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`);
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`);
  }
}

//API 2

const convertStateDBObject = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

app.get("/states/", authenticationToken, async (request, response) => {
  const selectStatesQuery = `SELECT * FROM state`;
  const selectDBResponse = await db.all(selectStatesQuery);
  response.send(
    selectDBResponse.map((eachState) => convertStateDBObject(eachState))
  );
});

//API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `select * from state where state_id = ${stateId};`;
  const getStateDetails = await db.get(getStateDetailsQuery);
  response.send(convertStateDBObject(getStateDetails));
});

//API 4
const convertDistrictObject = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) 
    values('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const districtResponse = await db.run(districtQuery);
  response.send(`District Successfully Added`);
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `select * from district where district_id = ${districtId};`;
    const getDistrictDetails = await db.get(getDistrictDetailsQuery);
    response.send(convertDistrictObject(getDistrictDetails));
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `delete from district where 
    district_id ='${districtId}';`;
    const deleteResponse = await db.run(deleteDistrict);
    response.send(`District Removed`);
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = request.body;
      const updateDistrictQuery = `update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId};`;

      const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
      response.send("District Details Updated");
    } catch (error) {
      console.log(`DB Error: ${error}`);
    }
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;
