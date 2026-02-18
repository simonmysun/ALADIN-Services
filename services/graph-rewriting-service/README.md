# Graph Rewriting As A Service

## Prerequisites

This repository contains all files necessary to run the application in a local development environment.
It does depend on Docker and Node.js being available on your system.

When cloning this repository and opening it through VSCode, it will ask you to install all recommended VSCode extensions.

## Getting started

In order to install and run this application in your local development environment, you first need to install all dependencies via npm

    npm install

Next an .env file should be created by copying the .env.example and setting the appropriate values.

## Running the application

You may start the project by running the tasks `docker compose up` and `npm run dev` in your terminal.

If using VSCode you can instead run the VSCode-Task `Start dev environment` as a shortcut.

## Documentation

For documentation of the rewrite and instantiation rules, please refer to the [Wiki](https://github.com/sonjaka/graph-rewriting-as-a-service/wiki).

## Demos

The demos and examples use .http files to define example requests that can be sent to the development server.
These can be run from VS Code with the [httpYak VSCode Extension](https://marketplace.visualstudio.com/items?itemName=anweber.vscode-httpyac). IntenlliJ natively supports http files.
httpYak also provides a CLI tool: [httpYak on the CLI](https://httpyac.github.io/guide/installation_cli.html).

### Demos

This repository contains three demos for graph rewriting requests.
They can be found in the /demo folder.

#### Sierpinsky-Triangles

Creates the third generation of a sierpinsky triangle through simple transformation rules.
A simple http-File to execute and send to the server.

#### UML to Petrinet

Genereates a Petrinet from the given UML diagram hostgraph and transformations rules.
A simple http-File to execute and send to the server

#### TicTacToe

A very simple TicTacToe game againt a computer player powered by graph transformations.
This testcase consists of a very basic web app built on the Vue.js Framework.
You can install the project by first running `npm install`, then `npm run dev`.

## SwaggerUI / OpenAPI

When the server is running, you can access the SwaggerUI / OpenAPI documentation via the following url:

https://<api_host>:<api_port>/documentation
