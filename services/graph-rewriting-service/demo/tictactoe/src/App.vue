<script setup lang="ts">
import TicTacToeBoard from './components/TicTacToeBoard.vue'
</script>

<template>
  <header>
    <h2>TicTacToe Demo</h2>
  </header>

  <main>
    <TicTacToeBoard></TicTacToeBoard>
  </main>
</template>

<style scoped>
@media (min-width: 1024px) {
  header {
    text-align: center;
    margin: 20px 0;
  }
}
</style>
