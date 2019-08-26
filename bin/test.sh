#!/bin/bash

set -e

ganache-cli 2> /dev/null 1> /dev/null &
sleep 5 # to make sure ganache-cli is up and running before compiling
rm -rf build
truffle compile
truffle migrate --reset --network test
truffle test
kill -9 $(lsof -t -i:8545)
