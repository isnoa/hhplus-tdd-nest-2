import { DataSource } from "typeorm";
import * as fs from "fs";
import { MySqlContainer } from "@testcontainers/mysql";
import { RedisContainer } from "@testcontainers/redis";
import { getDatasource } from "./util";

const init = async () => {
  await Promise.all([initMysql(), initRedis()]);
};

const initMysql = async () => {
  const mysql = await new MySqlContainer("mysql:8")
    .withDatabase("dbname")
    .withUser("root")
    .withRootPassword("pw")
    .start();

  global.mysql = mysql;

  process.env.DB_HOST = mysql.getHost();
  process.env.DB_PORT = mysql.getPort().toString();
  process.env.DB_USERNAME = mysql.getUsername();
  process.env.DB_PASSWORD = mysql.getUserPassword();
  process.env.DB_DATABASE = mysql.getDatabase();
  process.env.DB_LOGGING_ENABLED = "true";

  const datasource = await getDatasource();
  await datasource.runMigrations();
  await insertTestData(datasource);
};

const initRedis = async () => {
  const redis = await new RedisContainer("redis:7").start();
  global.redis = redis;

  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = redis.getPort().toString();
};

const insertTestData = async (datasource: DataSource) => {
  const importSql = fs.readFileSync("./test/it/import.sql").toString();
  for (const sql of importSql.split(";").filter((s) => s.trim() !== "")) {
    await datasource.query(sql);
  }
};

export default init;
