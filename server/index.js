const keys = require('./keys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const {
  REDIS_HOST,
  REDIS_PORT,
  PG_USER,
  PG_HOST,
  PG_DATABASE,
  PG_PASSWORD,
  PG_PORT,
} = process.env;

console.log('REDIS HOST: ', REDIS_HOST);
console.log('POSTGRES HOST: ', PG_HOST);

app.use(cors());
app.use(bodyParser.json());

const pgClient = new Pool({
  user: PG_USER,
  host: PG_HOST,
  database: PG_DATABASE,
  password: PG_PASSWORD,
  port: PG_PORT,
});

pgClient.on('error', () => console.log('PG Disconnected!!'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));

const redisClient = redis.createClient({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

app.get('/', (req, res) => {
  res.send('hi!');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');
  console.log('ALL VALUES: ', values);
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    console.log('REDIS GET_ALL: ', values);
    res.send(values);
  })
});

app.post('/values', async (req, res) => {
  const index = req.body.index;
  console.log('API POST VALUE: ', index);
  if (parseInt(index) > 40) return res.status(422).send('Index too high!');

  redisClient.hset('values', index, 'Nothing yet');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, () => {
  console.log(`Listening on server port 5000`);
});