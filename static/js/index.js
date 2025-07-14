function hashTargets(targets) {
  return targets
    .filter(isTargetComplete)
    .map(({wallet, percent, alias}) => `${wallet}${percent}${alias}`)
    .join('')
}

function isTargetComplete(target) {
  return (
    target.wallet &&
    target.wallet.trim() !== '' &&
    (target.percent > 0 || target.tag != '')
  )
}

window.app = Vue.createApp({
  el: '#vue',
  mixins: [windowMixin],
  watch: {
    selectedWallet() {
      this.getTargets()
    },
    splitDiagramData() {
      // Recreate flow charts when data changes
      this.$nextTick(() => {
        this.recreateCharts()
      })
    },
    currentStep() {
      this.$nextTick(() => {
        this.initFlowChart()
      })
    }
  },
  data() {
    return {
      // Wizard state
      currentStep: 1,
      maxSteps: 3,
      
      // Existing data
      selectedWallet: null,
      currentHash: '', // a string that must match if the edit data is unchanged
      targets: [],
      
      // Chart instances
      treeChart: null,
      treeChart2: null,
      chartUpdateTimeout: null
    }
  },
  computed: {
    // Step validation
    canProceedFromStep1() {
      return this.selectedWallet !== null
    },
    canProceedFromStep2() {
      return this.targets.length > 0 && this.totalPercent <= 100 && this.allTargetsValid
    },
    totalPercent() {
      return this.targets.reduce((sum, target) => sum + (target.percent || 0), 0)
    },
    remainingPercent() {
      return Math.max(0, 100 - this.totalPercent)
    },
    allTargetsValid() {
      return this.targets.every(target => 
        target.wallet && target.wallet.trim() !== '' && 
        target.percent > 0 && target.percent <= 100 &&
        target.alias && target.alias.trim() !== '' && target.alias.trim().length <= 50
      ) && !this.hasDuplicateRecipients && !this.hasDuplicateNames
    },
    hasValidationErrors() {
      return this.targets.some(target => 
        !target.wallet || target.wallet.trim() === '' ||
        !target.alias || target.alias.trim() === '' ||
        target.percent <= 0 || target.percent > 100
      ) || this.hasDuplicateRecipients || this.hasDuplicateNames
    },
    hasDuplicateRecipients() {
      const walletAddresses = this.targets
        .filter(target => target.wallet && target.wallet.trim() !== '')
        .map(target => target.wallet.trim().toLowerCase())
      
      return walletAddresses.length !== new Set(walletAddresses).size
    },
    hasDuplicateNames() {
      const splitNames = this.targets
        .filter(target => target.alias && target.alias.trim() !== '')
        .map(target => target.alias.trim().toLowerCase())
      
      return splitNames.length !== new Set(splitNames).size
    },
    validationSummary() {
      const errors = []
      if (this.targets.length === 0) {
        errors.push('At least one split target is required')
      }
      if (this.totalPercent > 100) {
        errors.push(`Total percentage (${this.totalPercent}%) exceeds 100%`)
      }
      if (this.hasDuplicateRecipients) {
        errors.push('Duplicate recipient addresses found - each recipient must be unique')
      }
      if (this.hasDuplicateNames) {
        errors.push('Duplicate split names found - each split name must be unique')
      }
      if (this.hasValidationErrors && !this.hasDuplicateRecipients && !this.hasDuplicateNames) {
        errors.push('Some fields have validation errors')
      }
      return errors
    },
    showPercentWarning() {
      return this.totalPercent > 90 && this.totalPercent < 100
    },
    showPercentError() {
      return this.totalPercent > 100
    },
    // Split diagram data
    splitDiagramData() {
      const data = []
      
      // Add source wallet (remaining percentage)
      if (this.remainingPercent > 0) {
        data.push({
          name: this.selectedWallet ? this.selectedWallet.name : 'Source',
          percent: this.remainingPercent,
          type: 'source',
          color: '#1976d2'
        })
      }
      
      // Add target wallets
      this.targets.forEach(target => {
        if (target.percent > 0 && target.alias) {
          data.push({
            name: target.alias,
            percent: target.percent,
            type: 'target',
            color: '#43a047'
          })
        }
      })
      
      return data.sort((a, b) => b.percent - a.percent)
    },
    isDirty() {
      return hashTargets(this.targets) !== this.currentHash
    }
  },
  methods: {
    // Wizard navigation
    nextStep() {
      if (this.currentStep < this.maxSteps) {
        if (this.currentStep === 1 && this.canProceedFromStep1) {
          this.currentStep++
          this.scrollToTop()
        } else if (this.currentStep === 2 && this.canProceedFromStep2) {
          this.currentStep++
          this.scrollToTop()
        }
      }
    },
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--
        this.scrollToTop()
      }
    },
    goToStep(step) {
      if (step >= 1 && step <= this.maxSteps) {
        this.currentStep = step
        this.scrollToTop()
      }
    },
    
    // Scroll to top of wizard
    scrollToTop() {
      this.$nextTick(() => {
        // Find the wizard container (the stepper card)
        const wizardElement = document.querySelector('.q-stepper') || document.querySelector('.q-card')
        if (wizardElement) {
          wizardElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest' 
          })
        } else {
          // Fallback to window scroll
          window.scrollTo({ 
            top: 0, 
            behavior: 'smooth' 
          })
        }
      })
    },
    
    // Validation helper methods
    isDuplicateRecipient(index) {
      const currentWallet = this.targets[index]?.wallet?.trim().toLowerCase()
      if (!currentWallet) return false
      
      return this.targets.some((target, i) => 
        i !== index && target.wallet?.trim().toLowerCase() === currentWallet
      )
    },
    isDuplicateName(index) {
      const currentName = this.targets[index]?.alias?.trim().toLowerCase()
      if (!currentName) return false
      
      return this.targets.some((target, i) => 
        i !== index && target.alias?.trim().toLowerCase() === currentName
      )
    },
    
    // SVG Flow Chart methods
    initFlowChart() {
      
      // Create chart for Step 2
      if (this.$refs.flowChart && this.currentStep === 2) {
        this.createFlowChart('flowChart')
      }
      
      // Create chart for Step 3  
      if (this.$refs.flowChart2 && this.currentStep === 3) {
        this.createFlowChart('flowChart2')
      }
    },
    recreateCharts() {
      // Safely recreate charts when data changes
      if (this.currentStep === 2 && this.splitDiagramData.length > 0) {
        this.$nextTick(() => {
          this.createFlowChart('flowChart')
        })
      }
      if (this.currentStep === 3 && this.splitDiagramData.length > 0) {
        this.$nextTick(() => {
          this.createFlowChart('flowChart2')
        })
      }
    },
    createFlowChart(containerRef) {
      try {
        if (!this.$refs[containerRef]) {
          console.warn('Container ref not found:', containerRef)
          return
        }
        
        const container = this.$refs[containerRef]
        
        // Clear previous content
        container.innerHTML = ''
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '100%')
        svg.setAttribute('height', '400')
        svg.setAttribute('viewBox', '0 0 400 400')
        svg.style.background = 'transparent'
        
        // Get targets data and source data
        const targets = this.splitDiagramData.filter(item => item.type === 'target')
        const sourceRemaining = this.splitDiagramData.filter(item => item.type === 'source')
        
        if (targets.length === 0) {
          container.appendChild(svg)
          return
        }
        
        // Define positions
        const sourceX = 200
        const sourceY = 80
        const branchY = 200
        const targetY = 320
        
        // Calculate bottom row items (targets + source if remaining > 0)
        const bottomRowItems = [...targets]
        if (sourceRemaining.length > 0 && this.remainingPercent > 0) {
          bottomRowItems.push({
            name: this.selectedWallet ? this.selectedWallet.name : 'Source',
            percent: this.remainingPercent,
            type: 'source_remaining',
            color: '#96A6FF'
          })
        }
        
        // Calculate positions for bottom row items
        const bottomRowPositions = []
        if (bottomRowItems.length === 1) {
          bottomRowPositions.push({ x: sourceX, y: targetY })
        } else {
          // Use the full width of the SVG viewBox (400px) with padding
          const padding = 10 // Padding from edges
          const totalWidth = 400 - (padding * 2) // Available width
          const spacing = totalWidth / (bottomRowItems.length - 1)
          const startX = padding
          
          bottomRowItems.forEach((item, index) => {
            bottomRowPositions.push({ x: startX + (index * spacing), y: targetY })
          })
        }
        
        // Calculate proportional line thickness
        const maxPercent = Math.max(...bottomRowItems.map(t => t.percent))
        const maxThickness = 30 // Maximum line thickness in pixels
        
        // Draw flowing lines - source_remaining lines first (behind other lines)
        // First pass: draw source_remaining lines
        bottomRowItems.forEach((item, index) => {
          if (item.type === 'source_remaining') {
            const itemPos = bottomRowPositions[index]
            // Calculate thickness proportional to the highest percentage
            const lineThickness = Math.max(3, (item.percent / maxPercent) * maxThickness)
            
            // End the line before the wallet icon (30px is wallet icon radius)
            const lineEndY = targetY - 45
            this.drawFlowingLine(svg, sourceX, sourceY + 35, itemPos.x, lineEndY, lineThickness, item.color || '#4ade80')
          }
        })
        
        // Second pass: draw target lines (on top of source_remaining lines)
        bottomRowItems.forEach((item, index) => {
          if (item.type === 'target') {
            const itemPos = bottomRowPositions[index]
            // Calculate thickness proportional to the highest percentage
            const lineThickness = Math.max(3, (item.percent / maxPercent) * maxThickness)
            
            // End the line before the wallet icon (30px is wallet icon radius)
            const lineEndY = targetY - 45
            this.drawFlowingLine(svg, sourceX, sourceY + 35, itemPos.x, lineEndY, lineThickness, item.color || '#4ade80')
          }
        })
        
        // Draw source Bitcoin logo
        this.drawBitcoinLogo(svg, sourceX, sourceY)
        
        // Draw bottom row wallet icons
        bottomRowItems.forEach((item, index) => {
          const itemPos = bottomRowPositions[index]
          if (item.type === 'source_remaining') {
            this.drawWalletIcon(svg, itemPos.x, itemPos.y, 'source_remaining', item.percent, item.name)
          } else {
            this.drawWalletIcon(svg, itemPos.x, itemPos.y, 'target', item.percent, item.name)
          }
        })
        
        container.appendChild(svg)
      } catch (error) {
        console.error('Error creating flow chart:', error)
      }
    },
    drawFlowingLine(svg, x1, y1, x2, y2, finalThickness, color) {
      // Create a tapered line that starts at 10px and increases to finalThickness
      const startThickness = 10
      const segments = 20 // Number of segments for smooth taper
      const midY = y1 + (y2 - y1) * 0.6
      
      // Generate points along the quadratic Bezier curve
      const points = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        let x, y
        
        if (t <= 0.5) {
          // First quadratic curve: (x1, y1) to ((x1+x2)/2, midY)
          const localT = t * 2
          const p0 = {x: x1, y: y1}
          const p1 = {x: x1, y: midY}
          const p2 = {x: (x1 + x2) / 2, y: midY}
          
          x = (1 - localT) * (1 - localT) * p0.x + 2 * (1 - localT) * localT * p1.x + localT * localT * p2.x
          y = (1 - localT) * (1 - localT) * p0.y + 2 * (1 - localT) * localT * p1.y + localT * localT * p2.y
        } else {
          // Second quadratic curve: ((x1+x2)/2, midY) to (x2, y2)
          const localT = (t - 0.5) * 2
          const p0 = {x: (x1 + x2) / 2, y: midY}
          const p1 = {x: x2, y: midY}
          const p2 = {x: x2, y: y2}
          
          x = (1 - localT) * (1 - localT) * p0.x + 2 * (1 - localT) * localT * p1.x + localT * localT * p2.x
          y = (1 - localT) * (1 - localT) * p0.y + 2 * (1 - localT) * localT * p1.y + localT * localT * p2.y
        }
        
        // Calculate thickness at this point
        const thickness = startThickness + (finalThickness - startThickness) * t
        points.push({x, y, thickness})
      }
      
      // Create polygon points for the tapered line
      const leftPoints = []
      const rightPoints = []
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i]
        const halfThickness = point.thickness / 2
        
        // Calculate direction vector
        let dx = 0, dy = 1
        if (i < points.length - 1) {
          dx = points[i + 1].x - point.x
          dy = points[i + 1].y - point.y
        } else if (i > 0) {
          dx = point.x - points[i - 1].x
          dy = point.y - points[i - 1].y
        }
        
        // Normalize direction vector
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length > 0) {
          dx /= length
          dy /= length
        }
        
        // Calculate perpendicular offset (rotate 90 degrees)
        const perpX = -dy
        const perpY = dx
        
        // Add points to left and right sides
        leftPoints.push({
          x: point.x + perpX * halfThickness,
          y: point.y + perpY * halfThickness
        })
        rightPoints.unshift({
          x: point.x - perpX * halfThickness,
          y: point.y - perpY * halfThickness
        })
      }
      
      // Create arrow tip pointing down
      const lastPoint = points[points.length - 1]
      const arrowHeight = 15 // Fixed arrow height so all arrows terminate at same Y position
      
      // Get the last left and right points to connect seamlessly
      const lastLeftPoint = leftPoints[leftPoints.length - 1]
      const lastRightPoint = rightPoints[0] // rightPoints is reversed, so first element is the last point
      
      // Arrow tip points - connect directly to the line ends
      const arrowTip = {x: lastPoint.x, y: lastPoint.y + arrowHeight}
      
      // Create combined polygon including line body and arrow
      const allPoints = [
        ...leftPoints.slice(0, -1), // All left points except the last one
        lastLeftPoint, // Last left point
        arrowTip, // Arrow tip
        lastRightPoint, // Last right point  
        ...rightPoints.slice(1) // All right points except the first one
      ]
      
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      const pointsString = allPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
      
      polygon.setAttribute('points', pointsString)
      polygon.setAttribute('fill', color)
      polygon.setAttribute('opacity', '1')
      
      svg.appendChild(polygon)
    },
    
    drawWalletIcon(svg, x, y, type, percentage, targetName = null) {
      // Create wallet icon using the PNG image
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      image.setAttribute('x', x - 30)
      image.setAttribute('y', y - 30)
      image.setAttribute('width', 60)
      image.setAttribute('height', 60)
      
      // Try different possible paths for the wallet icon
      const possiblePaths = [
        '/splitpayments/static/image/icon-wallet.png',
        '/static/image/icon-wallet.png',
        'static/image/icon-wallet.png'
      ]
      
      image.setAttribute('href', possiblePaths[0])
      
      // Add color filter for source vs target distinction
      if (type === 'source' || type === 'source_remaining') {
        // Add blue tint for source wallet
        image.setAttribute('style', 'filter: hue-rotate(200deg) saturate(1.2)')
      }
      
      // Add error handling - if image fails to load, show a fallback
      image.addEventListener('error', () => {
        console.warn('Failed to load wallet icon, using fallback')
        // Remove the broken image and replace with a styled rectangle
        svg.removeChild(image)
        this.drawFallbackWalletIcon(svg, x, y, type, percentage, targetName)
      })
      
      svg.appendChild(image)
      
      // Add source wallet name above icon if it's a source
      if (type === 'source') {
        // Add source wallet name text above the icon
        const sourceNameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        sourceNameText.setAttribute('x', x)
        sourceNameText.setAttribute('y', y - 45)
        sourceNameText.setAttribute('text-anchor', 'middle')
        sourceNameText.setAttribute('fill', '#1976d2')
        sourceNameText.setAttribute('font-family', 'Arial, sans-serif')
        sourceNameText.setAttribute('font-size', '14px')
        sourceNameText.setAttribute('font-weight', 'bold')
        sourceNameText.textContent = this.selectedWallet ? this.selectedWallet.name : 'Source Wallet'
        
        svg.appendChild(sourceNameText)
      }
      
      // Add name and percentage below icon for targets and source_remaining
      if (type === 'target' || type === 'source_remaining') {
        // Add name text
        if (targetName) {
          const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          nameText.setAttribute('x', x)
          nameText.setAttribute('y', y + 45)
          nameText.setAttribute('text-anchor', 'middle')
          nameText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : '#374151')
          nameText.setAttribute('font-family', 'Arial, sans-serif')
          nameText.setAttribute('font-size', '14px')
          nameText.setAttribute('font-weight', 'bold')
          nameText.textContent = targetName
          
          svg.appendChild(nameText)
        }
        
        // Add percentage text below name
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        percentText.setAttribute('x', x)
        percentText.setAttribute('y', y + 80)
        percentText.setAttribute('text-anchor', 'middle')
        percentText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : '#f59e0b')
        percentText.setAttribute('font-family', 'Arial, sans-serif')
        percentText.setAttribute('font-size', '32px')
        percentText.setAttribute('font-weight', 'bold')
        percentText.textContent = `${percentage}%`
        
        svg.appendChild(percentText)
      }
    },
    
    drawFallbackWalletIcon(svg, x, y, type, percentage, targetName = null) {
      // Fallback wallet icon when PNG fails to load
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', x - 30)
      rect.setAttribute('y', y - 30)
      rect.setAttribute('width', 60)
      rect.setAttribute('height', 60)
      rect.setAttribute('rx', 12)
      rect.setAttribute('fill', (type === 'source' || type === 'source_remaining') ? (type === 'source_remaining' ? '#96A6FF' : '#6366f1') : '#f59e0b')
      rect.setAttribute('stroke', '#1f2937')
      rect.setAttribute('stroke-width', 2)
      
      svg.appendChild(rect)
      
      // Add Bitcoin symbol
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', x)
      text.setAttribute('y', y + 5)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', 'white')
      text.setAttribute('font-family', 'Arial, sans-serif')
      text.setAttribute('font-size', '24')
      text.setAttribute('font-weight', 'bold')
      text.textContent = '₿'
      
      svg.appendChild(text)
      
      // Add source wallet name above icon if it's a source
      if (type === 'source') {
        // Add source wallet name text above the icon
        const sourceNameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        sourceNameText.setAttribute('x', x)
        sourceNameText.setAttribute('y', y - 45)
        sourceNameText.setAttribute('text-anchor', 'middle')
        sourceNameText.setAttribute('fill', '#1976d2')
        sourceNameText.setAttribute('font-family', 'Arial, sans-serif')
        sourceNameText.setAttribute('font-size', '14px')
        sourceNameText.setAttribute('font-weight', 'bold')
        sourceNameText.textContent = this.selectedWallet ? this.selectedWallet.name : 'Source Wallet'
        
        svg.appendChild(sourceNameText)
      }
      
      // Add name and percentage below icon for targets and source_remaining
      if (type === 'target' || type === 'source_remaining') {
        // Add name text
        if (targetName) {
          const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          nameText.setAttribute('x', x)
          nameText.setAttribute('y', y + 45)
          nameText.setAttribute('text-anchor', 'middle')
          nameText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : '#374151')
          nameText.setAttribute('font-family', 'Arial, sans-serif')
          nameText.setAttribute('font-size', '14px')
          nameText.setAttribute('font-weight', 'bold')
          nameText.textContent = targetName
          
          svg.appendChild(nameText)
        }
        
        // Add percentage text below name
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        percentText.setAttribute('x', x)
        percentText.setAttribute('y', y + 65)
        percentText.setAttribute('text-anchor', 'middle')
        percentText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : '#f59e0b')
        percentText.setAttribute('font-family', 'Arial, sans-serif')
        percentText.setAttribute('font-size', '16px')
        percentText.setAttribute('font-weight', 'bold')
        percentText.textContent = `${percentage}%`
        
        svg.appendChild(percentText)
      }
    },
    
    drawBitcoinLogo(svg, x, y) {
      // Create Bitcoin logo using SVG
      const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      
      const bitcoinPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      bitcoinPath.setAttribute('d', 'M39.0674606,19.3675957 L40.5054606,13.5995957 L36.9944606,12.7245957 L35.5944606,18.3405957 C34.6714606,18.1105957 33.7234606,17.8935957 32.7814606,17.6785957 L34.1914606,12.0255957 L30.6824606,11.1505957 L29.2434606,16.9165957 C28.4794606,16.7425957 27.7294606,16.5705957 27.0014606,16.3895957 L27.0054606,16.3715957 L22.1634606,15.1625957 L21.2294606,18.9125957 C21.2294606,18.9125957 23.8344606,19.5095957 23.7794606,19.5465957 C25.2014606,19.9015957 25.4584606,20.8425957 25.4154606,21.5885957 L23.7774606,28.1595957 L23.7714606,28.1845957 L21.4754606,37.3895957 C21.3014606,37.8215957 20.8604606,38.4695957 19.8664606,38.2235957 C19.9014606,38.2745957 17.3144606,37.5865957 17.3144606,37.5865957 L15.5714606,41.6055957 L20.1404606,42.7445957 C20.9904606,42.9575957 21.8234606,43.1805957 22.6434606,43.3905957 L21.1904606,49.2245957 L24.6974606,50.0995957 L26.1364606,44.3275957 C27.0944606,44.5875957 28.0244606,44.8275957 28.9344606,45.0535957 L27.5004606,50.7985957 L31.0114606,51.6735957 L32.4644606,45.8505957 C38.4514606,46.9835957 42.9534606,46.5265957 44.8484606,41.1115957 C46.3754606,36.7515957 44.7724606,34.2365957 41.6224606,32.5965957 C43.9164606,32.0675957 45.6444606,30.5585957 46.1054606,27.4415957 C46.7424606,23.1835957 43.5004606,20.8945957 39.0674606,19.3675957 Z M38.0834606,38.6905957 C36.9984606,43.0505957 29.6574606,40.6935957 27.2774606,40.1025957 L29.2054606,32.3735957 C31.5854606,32.9675957 39.2174606,34.1435957 38.0834606,38.6905957 Z M39.1694606,27.3785957 C38.1794606,31.3445957 32.0694606,29.3295957 30.0874606,28.8355957 L31.8354606,21.8255957 C33.8174606,22.3195957 40.2004606,23.2415957 39.1694606,27.3785957 Z')
      bitcoinPath.setAttribute('fill', '#f7931a') // Orange color for Bitcoin
      bitcoinPath.setAttribute('transform', `translate(${x - 45}, ${y - 50}) scale(1.4)`) // Scale and position the logo
      
      logoGroup.appendChild(bitcoinPath)
      svg.appendChild(logoGroup)
      
      // Add "Incoming Payment" text above the Bitcoin logo
      const incomingText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      incomingText.setAttribute('x', x)
      incomingText.setAttribute('y', y - 50)
      incomingText.setAttribute('text-anchor', 'middle')
      incomingText.setAttribute('fill', '#f7931a')
      incomingText.setAttribute('font-family', 'Arial, sans-serif')
      incomingText.setAttribute('font-size', '16px')
      incomingText.setAttribute('font-weight', 'bold')
      incomingText.textContent = 'Incoming Payment'
      
      svg.appendChild(incomingText)
    },
    
    addPercentageLabel(svg, x, y, percentage, color) {
      // Create background circle for percentage
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', x)
      circle.setAttribute('cy', y)
      circle.setAttribute('r', 20)
      circle.setAttribute('fill', color)
      circle.setAttribute('opacity', '1')
      
      svg.appendChild(circle)
      
      // Add percentage text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', x)
      text.setAttribute('y', y + 6)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', 'white')
      text.setAttribute('font-family', 'Arial, sans-serif')
      text.setAttribute('font-size', '20px')
      text.setAttribute('font-weight', 'bold')
      text.textContent = percentage
      
      svg.appendChild(text)
    },
    
    // Target management methods
    clearTarget(index) {
      if (this.targets.length == 1) {
        return this.deleteTargets()
      }
      this.targets.splice(index, 1)
      Quasar.Notify.create({
        message: 'Removed item. You must click to save manually.',
        timeout: 500
      })
    },
    getTargets() {
      LNbits.api
        .request(
          'GET',
          '/splitpayments/api/v1/targets',
          this.selectedWallet.adminkey
        )
        .then(res => {
          this.targets = res.data.map(t => ({
            ...t,
            targetChoice: t.targetChoice || 'wallet'
          }))
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
        })
    },
    changedWallet(wallet) {
      this.selectedWallet = wallet
      this.getTargets()
    },
    addTarget() {
      this.targets.push({
        source: this.selectedWallet,
        alias: '',
        wallet: '',
        percent: 0
      })
    },
    saveTargets() {
      // Final validation before saving
      if (this.validationSummary.length > 0) {
        Quasar.Notify.create({
          message: 'Please fix validation errors before saving.',
          timeout: 3000,
          color: 'negative',
          icon: 'error'
        })
        return
      }

      if (!this.selectedWallet) {
        Quasar.Notify.create({
          message: 'Please select a source wallet.',
          timeout: 3000,
          color: 'negative',
          icon: 'error'
        })
        this.currentStep = 1
        this.scrollToTop()
        return
      }

      LNbits.api
        .request(
          'PUT',
          '/splitpayments/api/v1/targets',
          this.selectedWallet.adminkey,
          {
            targets: payload
          }
        )
        .then(response => {
          Quasar.Notify.create({
            message: `Split payments activated! ${this.targets.length} target${this.targets.length !== 1 ? 's' : ''} configured.`,
            timeout: 5000,
            color: 'positive',
            icon: 'check_circle',
            actions: [
              {
                label: 'Dismiss',
                color: 'white',
                handler: () => {}
              }
            ]
          })
          // Update hash to reflect saved state
          this.currentHash = hashTargets(this.targets)
          // Reset to step 1 after successful save
          this.currentStep = 1
          this.scrollToTop()
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
          Quasar.Notify.create({
            message: 'Failed to save split payment configuration. Please try again.',
            timeout: 5000,
            color: 'negative',
            icon: 'error'
          })
        })
    },
    deleteTargets() {
      LNbits.utils
        .confirmDialog('Are you sure you want to delete all targets?')
        .onOk(() => {
          this.targets = []
          LNbits.api
            .request(
              'DELETE',
              '/splitpayments/api/v1/targets',
              this.selectedWallet.adminkey
            )
            .then(response => {
              Quasar.Notify.create({
                message: 'Split payments targets deleted.',
                timeout: 700
              })
            })
            .catch(err => {
              LNbits.utils.notifyApiError(err)
            })
        })
    },
    
    async checkExistingConfigurations() {
      // Check each wallet for existing split payment configurations
      for (const wallet of this.g.user.wallets) {
        try {
          const response = await LNbits.api.request(
            'GET',
            '/splitpayments/api/v1/targets',
            wallet.adminkey
          )
          if (response.data && response.data.length > 0) {
            // Found existing configuration, select this wallet
            this.selectedWallet = wallet
            this.getTargets()
            return
          }
        } catch (err) {
          // Wallet has no configuration, continue checking others
          continue
        }
      }
      
      // No existing configurations found, select first wallet
      if (this.g.user.wallets.length > 0) {
        this.selectedWallet = this.g.user.wallets[0]
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initFlowChart()
    })
  },
  beforeUnmount() {
    // Clean up flow chart containers
    if (this.$refs.flowChart) {
      this.$refs.flowChart.innerHTML = ''
    }
    if (this.$refs.flowChart2) {
      this.$refs.flowChart2.innerHTML = ''
    }
  }
})
