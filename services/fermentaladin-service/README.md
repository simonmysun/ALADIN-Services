# Fermentation Model - FermentALADIN

Last Change: 06.03.2026

This is the backend code of the FermentALADIN Fermentation model.

!WICHTIG! An der Main (main.py) bitte nicht herumschrauben – Erweiterungen/Änderungen ausschließlich über die Adapter und die CLI-Parameter (Util/argparser.py). Sonst haut das mit der Schnittstelle zu ALADIN nicht hin.

## Usage

Main.py uses a command line interface for controlling its inputs and outputs

USAGE

```sh
uv run main.py -i [Input-Type = stdin|file|excel] -p [file-path] -o[Output-type= df|Chart] optional: -f [output filename] -h
```

Input-type (zum Auslesen der User-Inputparameter der Modellierung)

* stdin - Standardmethode einlesen der Daten aus der Kommandozeile#
* file - zum Auslesen aus einer JSON Datei
* excel - zum direkten Auslesen aus der Datei "./test/Bioreaktor_forPy.xlsx"

OUTPUT Adapter

* df - Schreiben als Dataframe 
* Chart - als Chart.Js 

Output 

* Standardmethode (ohne Angabe von Parametern) ist stdout
* -f = file - zum Schreiben in eine Datei

Help

-h - displays an explanation about usage

Example

```sh
uv run src/main.py -i file -p ./test/test_data/user_input.json -o df -f ausgabe.json
```

This reads the model parameters from file ./test/test_data/user_input.json and creates a file ausgabe.json in a Dataframe format

Example for usage with Excel as GUI

```sh
uv run src/main.py -i excel -p ./test/Bioreactor_forPy.xlsx -o df -f ausgabe.json
```

This reads the model parameters from file ./test/Bioreactor_forPy.xlsx and creates a file ausgabe.json in a Dataframe format

## Architecture

### Input

The models parameters are read (depending on the CLI switch) from 

* from Excel-file, 
* STDIN or 
* JSON file) 

and passed to main.py. 

The model constants are stored in the file ".\src\DataModels\model_db.json". Updating of this model "database" is done from the excel file. 

Output: als dataframe in JSON oder als Chart.js dump

All calculation source code is stored in folder „src/calc“.

### Modelldatenbank aktualisieren:

Die Synchronisation der Excel mit der „Model-Datenbank" (src\DataModels\model_db.json) ist als Utility implementiert (src\Util\sync_excel_models_to_json_file.py) und sollte gezielt ausgeführt werden 

### Plotten der Ergebnisse in Python

Um die Modellergebnisse in Python zu Plotten, liegt unter Util "src\Util\multiplot_ferm.py". Der Aufruf ist in der Main auskommentiert. Zum Testen kann man es wieder einkommentieren oder einfach in nen Test-Case auslagern.

### Use of Interfaces

To reduce the coupling of the current variable naming of the input-format and the models to the code that performs the calculation, the DataModels may be used. If the name of a variable changes (e.g. in the input-format) only the name of the right hand side of the respective enum has to be adapted. If a new variables is introduced, it should be added to the DataModels as well.
TODO: Adapt for string values in Fx_ODE_Bioreaktor.py as well.



## Installing new packages

To install new packages run

```sh
uv pip install [package]
```

where `[package]` should be replaced with the name of the package you want to install.

## Developing and running tests

To ensure the functionality of the code, create unit tests that determine whether the expected result is returned. New tests should be put into the `test`-directory and include `test` in their filename. Multiple tests can be grouped together in one file.

The tests can be executed with the following command:

```sh
uv run pytest
```

Ideally, the tests cover the entirety of the code base. Whether this is the case or not can be checked with:

```sh
uv run pytest --cov=.
```

## DEBUGGING und Programmlog

Statusausgaben sind über über Logger implementiert. Das LOG_LEVEL kann über eine „.env“-Datei im Wurzelverzeichnis des Repositories gesteuert werden – Default bei Nicht-Setzung ist „INFO“. Es ist gute Praxis die .env-Datei nicht zu versionieren, da diese ggf. auch Geheimnisse enthalten kann, die nicht öffentlich im Git stehen sollen. D. h. die musst du dir einmal manuell anlegen. Die „.demo.env“ ist nur zur Doku der vorhandenen Variablen.

## REMARKS

Output Adapter DF: funktioniert nicht zum Anzeigen der JSON Datei im Browser da Value Pairs erzeugt werden und kein JSON Array
