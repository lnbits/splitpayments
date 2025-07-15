// Split Payments Flow Chart Component
window.SplitPaymentsChart = Vue.defineComponent({
  name: 'SplitPaymentsChart',
  props: {
    splitDiagramData: {
      type: Array,
      required: true
    },
    selectedWallet: {
      type: Object,
      default: null
    },
    remainingPercent: {
      type: Number,
      default: 0
    }
  },
  mounted() {
    this.createFlowChart()
  },
  watch: {
    splitDiagramData: {
      handler() {
        this.$nextTick(() => {
          this.createFlowChart()
        })
      },
      deep: true
    }
  },
  methods: {
    createFlowChart() {
      try {
        const container = this.$refs.chartContainer
        if (!container) {
          console.warn('Chart container not found')
          return
        }
        
        // Clear previous content
        container.innerHTML = ''
        
        // Detect dark theme
        const isDarkTheme = document.body.classList.contains('body--dark')
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '100%')
        svg.setAttribute('height', '500')
        svg.setAttribute('viewBox', '0 0 400 450')
        svg.style.background = 'transparent'
        
        // Get targets data and source data
        const targets = this.splitDiagramData.filter(item => item.type === 'target')
        const sourceRemaining = this.splitDiagramData.filter(item => item.type === 'source')
        
        if (targets.length === 0 && sourceRemaining.length === 0) {
          container.appendChild(svg)
          return
        }
        
        // Define positions
        const sourceX = 200
        const sourceY = 80
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
        this.drawBitcoinLogo(svg, sourceX, sourceY, isDarkTheme)
        
        // Draw bottom row wallet icons
        bottomRowItems.forEach((item, index) => {
          const itemPos = bottomRowPositions[index]
          if (item.type === 'source_remaining') {
            this.drawWalletIcon(svg, itemPos.x, itemPos.y, 'source_remaining', item.percent, item.name, isDarkTheme)
          } else {
            this.drawWalletIcon(svg, itemPos.x, itemPos.y, 'target', item.percent, item.name, isDarkTheme)
          }
        })
        
        container.appendChild(svg)
        console.log('Flow chart created successfully')
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
    
    drawWalletIcon(svg, x, y, type, percentage, targetName = null, isDarkTheme = false) {
      // Create wallet icon using the PNG image
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      image.setAttribute('x', x - 30)
      image.setAttribute('y', y - 30)
      image.setAttribute('width', 60)
      image.setAttribute('height', 60)
      
      image.setAttribute('href', '/splitpayments/static/image/icon-wallet.png')
      
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
      })
      
      svg.appendChild(image)
      
      // Add name and percentage below icon for targets and source_remaining
      if (type === 'target' || type === 'source_remaining') {
        // Add name text
        if (targetName) {
          const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          nameText.setAttribute('x', x)
          nameText.setAttribute('y', y + 55)
          nameText.setAttribute('text-anchor', 'middle')
          nameText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : (isDarkTheme ? '#f3f4f6' : '#374151'))
          nameText.setAttribute('class', 'text-body2')
          nameText.textContent = targetName
          
          svg.appendChild(nameText)
        }
        
        // Add percentage text below name
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        percentText.setAttribute('x', x)
        percentText.setAttribute('y', y + 85)
        percentText.setAttribute('text-anchor', 'middle')
        percentText.setAttribute('fill', type === 'source_remaining' ? '#96A6FF' : '#f59e0b')
        percentText.setAttribute('class', 'text-h5')
        percentText.textContent = `${percentage}%`
        
        svg.appendChild(percentText)
      }
    },
    
    drawBitcoinLogo(svg, x, y, isDarkTheme = false) {
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
      incomingText.setAttribute('fill', isDarkTheme ? '#f9ca24' : '#f7931a')
      incomingText.textContent = 'Incoming Payment'
      
      svg.appendChild(incomingText)
    }
  },
  
  template: `
    <div class="flow-chart-container">
      <div ref="chartContainer" class="flow-chart"></div>
    </div>
  `
})